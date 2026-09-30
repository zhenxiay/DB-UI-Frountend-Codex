// @vitest-environment node

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const databaseModuleMock = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('../src/auth', () => ({ auth: authMock }));
vi.mock('../src/lib/auth-environment', () => ({
  readAuthEnvironment: () => ({ ENTRA_ALLOWED_USER: 'allowed@example.test' }),
}));
vi.mock('../src/server/db', () => databaseModuleMock);

import { createAccountForUser } from '../src/server/accounts/service';
import { listCalculatedAccountBalances } from '../src/server/accounts/balance';
import { getAccountsForUser, listAccounts } from '../src/server/accounts/query';
import { AccessDeniedError } from '../src/server/auth/authorization';
import { schema } from '../src/server/db/schema';
import {
  createTransactionForUser,
  deleteTransactionForUser,
  updateTransactionForUser,
} from '../src/server/transactions/service';

const actor = { id: 'entra-subject', email: 'allowed@example.test' };
const directories: string[] = [];
const clients: Array<{ close: () => void }> = [];

afterEach(() => {
  authMock.mockReset();
  databaseModuleMock.db = undefined;
  for (const client of clients.splice(0)) client.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function openDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-account-balance-'));
  directories.push(directory);
  const sqlite = new Database(join(directory, 'data.sqlite'));
  clients.push(sqlite);
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: join(process.cwd(), 'drizzle') });
  return database;
}

function addAccount(database: ReturnType<typeof openDatabase>, name: string, opening: number) {
  return createAccountForUser(database, actor, {
    name,
    typeLabel: 'Checking',
    openingBalanceMinor: opening,
  });
}

function addTransaction(
  database: ReturnType<typeof openDatabase>,
  accountId: string,
  type: 'income' | 'expense',
  amountMinor: number,
) {
  return createTransactionForUser(database, actor, {
    accountId,
    categoryId: type === 'income' ? 'income-salary' : 'expense-groceries',
    type,
    amountMinor,
    transactionDate: '2026-03-10',
    entryDate: '2026-03-11',
  });
}

describe('calculated account balances', () => {
  it('returns opening balances, including zero and negative, for accounts without transactions', () => {
    const database = openDatabase();
    addAccount(database, 'Positive', 1450);
    addAccount(database, 'Zero', 0);
    addAccount(database, 'Negative', -450);

    expect(
      listAccounts(database).map(({ name, currentBalanceMinor }) => [name, currentBalanceMinor]),
    ).toEqual([
      ['Positive', 1450],
      ['Zero', 0],
      ['Negative', -450],
    ]);
  });

  it('adds income, subtracts expenses, and isolates accounts while retaining empty accounts', () => {
    const database = openDatabase();
    const main = addAccount(database, 'Main', 1000);
    const expenseOnly = addAccount(database, 'Expense only', 0);
    addAccount(database, 'Empty', 200);
    addTransaction(database, main.id, 'income', 2500);
    addTransaction(database, main.id, 'expense', 3000);
    addTransaction(database, expenseOnly.id, 'expense', 750);

    expect(
      listCalculatedAccountBalances(database).map(({ name, currentBalanceMinor }) => [
        name,
        currentBalanceMinor,
      ]),
    ).toEqual([
      ['Main', 500],
      ['Expense only', -750],
      ['Empty', 200],
    ]);
  });

  it('recalculates fresh values after create, edit, move, and delete', () => {
    const database = openDatabase();
    const main = addAccount(database, 'Main', 100);
    const other = addAccount(database, 'Other', 0);
    const balances = () =>
      Object.fromEntries(
        listAccounts(database).map((account) => [account.id, account.currentBalanceMinor]),
      );

    const transaction = addTransaction(database, main.id, 'income', 50);
    expect(balances()).toEqual({ [main.id]: 150, [other.id]: 0 });

    updateTransactionForUser(database, actor, transaction.id, {
      accountId: main.id,
      categoryId: 'expense-groceries',
      type: 'expense',
      amountMinor: 75,
      transactionDate: '2026-03-10',
      entryDate: '2026-03-11',
    });
    expect(balances()).toEqual({ [main.id]: 25, [other.id]: 0 });

    updateTransactionForUser(database, actor, transaction.id, {
      accountId: other.id,
      categoryId: 'income-salary',
      type: 'income',
      amountMinor: 25,
      transactionDate: '2026-03-10',
      entryDate: '2026-03-11',
    });
    expect(balances()).toEqual({ [main.id]: 100, [other.id]: 25 });

    deleteTransactionForUser(database, actor, transaction.id);
    expect(balances()).toEqual({ [main.id]: 100, [other.id]: 0 });
  });

  it('keeps intermediate arithmetic exact and rejects unsafe stored or resulting amounts', () => {
    const database = openDatabase();
    const account = addAccount(database, 'Limit', Number.MAX_SAFE_INTEGER);
    addTransaction(database, account.id, 'income', 1);
    addTransaction(database, account.id, 'expense', 1);
    expect(listAccounts(database)[0].currentBalanceMinor).toBe(Number.MAX_SAFE_INTEGER);

    addTransaction(database, account.id, 'income', 1);
    expect(() => listAccounts(database)).toThrow(RangeError);

    database.$client.prepare('DELETE FROM transactions WHERE account_id = ?').run(account.id);
    database.$client
      .prepare('UPDATE accounts SET opening_balance_minor = ? WHERE id = ?')
      .run(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1), account.id);
    expect(() => listAccounts(database)).toThrow(/Opening balance.*safe integer range/);

    database.$client
      .prepare('UPDATE accounts SET opening_balance_minor = 0 WHERE id = ?')
      .run(account.id);
    database.$client
      .prepare(
        `INSERT INTO transactions
        (id, account_id, category_id, type, amount_minor, transaction_date, entry_date, created_at, updated_at)
        VALUES (?, ?, 'income-salary', 'income', ?, '2026-03-10', '2026-03-11', 0, 0)`,
      )
      .run('unsafe-amount', account.id, BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1));
    expect(() => listAccounts(database)).toThrow(/Transaction amount.*safe integer range/);
  });

  it('authorizes before the database read and returns the shared calculated result', async () => {
    const database = openDatabase();
    const account = addAccount(database, 'Allowed', 500);
    addTransaction(database, account.id, 'expense', 125);
    databaseModuleMock.db = database;

    authMock.mockResolvedValue({ user: actor });
    await expect(getAccountsForUser()).resolves.toEqual([
      {
        id: account.id,
        name: 'Allowed',
        typeLabel: 'Checking',
        openingBalanceMinor: 500,
        currentBalanceMinor: 375,
      },
    ]);

    for (const session of [undefined, null, { user: { email: 'denied@example.test' } }]) {
      authMock.mockResolvedValue(session);
      await expect(getAccountsForUser()).rejects.toBeInstanceOf(AccessDeniedError);
    }
  });
});
