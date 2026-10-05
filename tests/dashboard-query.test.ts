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

import { AccessDeniedError } from '../src/server/auth/authorization';
import { schema } from '../src/server/db/schema';
import {
  getDashboardForUser,
  parseDashboardMonth,
  readDashboard,
} from '../src/server/dashboard/query';

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
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-dashboard-'));
  directories.push(directory);
  const sqlite = new Database(join(directory, 'data.sqlite'));
  clients.push(sqlite);
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: join(process.cwd(), 'drizzle') });
  return database;
}

type TestDatabase = ReturnType<typeof openDatabase>;

function addAccount(database: TestDatabase, id: string, openingBalanceMinor = 0) {
  database
    .insert(schema.accounts)
    .values({
      id,
      name: `Name ${id}`,
      typeLabel: 'Checking',
      openingBalanceMinor,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
}

function addTransaction(
  database: TestDatabase,
  id: string,
  accountId: string,
  type: 'income' | 'expense',
  amountMinor: number,
  transactionDate: string,
  entryDate = transactionDate,
  categoryId = type === 'income' ? 'income-salary' : 'expense-groceries',
) {
  database
    .insert(schema.transactions)
    .values({
      id,
      accountId,
      categoryId,
      type,
      amountMinor,
      transactionDate,
      entryDate,
      payee: `Payee ${id}`,
      notes: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
}

describe('dashboard read model', () => {
  it('returns exact zero and empty lists with no data, and keeps accounts without transactions', () => {
    const database = openDatabase();
    expect(readDashboard(database, '2026-03')).toEqual({
      month: '2026-03',
      accounts: [],
      totalBalanceMinor: 0,
      recentTransactions: [],
      incomeMinor: 0,
      expensesMinor: 0,
      netMinor: 0,
      categorySpending: [],
    });

    addAccount(database, 'empty', -125);
    const result = readDashboard(database, '2026-03');
    expect(result.accounts).toMatchObject([{ id: 'empty', currentBalanceMinor: -125 }]);
    expect(result.totalBalanceMinor).toBe(-125);
    expect(result.categorySpending).toEqual([]);
  });

  it('reuses account balances and sums negative balances into the total', () => {
    const database = openDatabase();
    addAccount(database, 'first', 1000);
    addAccount(database, 'second', -300);
    addAccount(database, 'third', 75);
    addTransaction(database, 'income', 'first', 'income', 200, '2026-03-10');
    addTransaction(database, 'expense', 'second', 'expense', 400, '2026-03-11');

    const result = readDashboard(database, '2026-03');
    expect(result.accounts.map((account) => account.currentBalanceMinor)).toEqual([1200, -700, 75]);
    expect(result.totalBalanceMinor).toBe(575);
    expect(result.incomeMinor).toBe(200);
    expect(result.expensesMinor).toBe(400);
    expect(result.netMinor).toBe(-200);
  });

  it('returns five recent items across all accounts, sorting date then entry date then ID', () => {
    const database = openDatabase();
    addAccount(database, 'a');
    addAccount(database, 'b');
    addTransaction(database, 'outside', 'a', 'expense', 1, '2026-12-02');
    addTransaction(database, 'tie-b', 'b', 'income', 2, '2026-03-10', '2026-03-11');
    addTransaction(database, 'tie-a', 'a', 'expense', 3, '2026-03-10', '2026-03-11');
    addTransaction(database, 'earlier-entry', 'b', 'expense', 4, '2026-03-10', '2026-03-09');
    addTransaction(database, 'older', 'a', 'expense', 5, '2026-02-28');
    addTransaction(database, 'sixth', 'b', 'expense', 6, '2026-01-01');

    const result = readDashboard(database, '2026-03');
    expect(result.recentTransactions.map((item) => item.id)).toEqual([
      'outside',
      'tie-a',
      'tie-b',
      'earlier-entry',
      'older',
    ]);
    expect(result.recentTransactions[2]).toMatchObject({
      transactionDate: '2026-03-10',
      entryDate: '2026-03-11',
      type: 'income',
      amountMinor: 2,
      payee: 'Payee tie-b',
      accountId: 'b',
      accountName: 'Name b',
      categoryId: 'income-salary',
      categoryName: 'Salary',
    });
  });

  it('uses transaction dates and half-open month bounds across leap day and year-end', () => {
    const database = openDatabase();
    addAccount(database, 'a');
    addTransaction(database, 'before-feb', 'a', 'expense', 1, '2024-01-31', '2024-02-01');
    addTransaction(database, 'feb-first', 'a', 'income', 100, '2024-02-01', '2024-03-01');
    addTransaction(database, 'leap-day', 'a', 'expense', 30, '2024-02-29', '2024-03-01');
    addTransaction(database, 'after-feb', 'a', 'expense', 2, '2024-03-01', '2024-02-29');
    addTransaction(database, 'dec-first', 'a', 'expense', 5, '2024-12-01');
    addTransaction(database, 'dec-last', 'a', 'income', 20, '2024-12-31');
    addTransaction(database, 'jan-first', 'a', 'expense', 7, '2025-01-01');

    expect(readDashboard(database, '2024-02')).toMatchObject({
      incomeMinor: 100,
      expensesMinor: 30,
      netMinor: 70,
    });
    expect(readDashboard(database, '2024-12')).toMatchObject({
      incomeMinor: 20,
      expensesMinor: 5,
      netMinor: 15,
    });
    expect(readDashboard(database, '2025-01')).toMatchObject({
      incomeMinor: 0,
      expensesMinor: 7,
      netMinor: -7,
    });
  });

  it('groups only expenses by persisted category identity and name', () => {
    const database = openDatabase();
    addAccount(database, 'a');
    addTransaction(database, 'groceries-1', 'a', 'expense', 100, '2026-03-01');
    addTransaction(database, 'groceries-2', 'a', 'expense', 250, '2026-03-02');
    addTransaction(
      database,
      'dining',
      'a',
      'expense',
      80,
      '2026-03-03',
      '2026-03-03',
      'expense-dining',
    );
    addTransaction(database, 'salary', 'a', 'income', 900, '2026-03-04');
    addTransaction(database, 'outside', 'a', 'expense', 10, '2026-04-01');

    const result = readDashboard(database, '2026-03');
    expect(result).toMatchObject({ incomeMinor: 900, expensesMinor: 430, netMinor: 470 });
    expect(result.categorySpending).toEqual([
      { categoryId: 'expense-groceries', categoryName: 'Groceries', amountMinor: 350 },
      { categoryId: 'expense-dining', categoryName: 'Dining out', amountMinor: 80 },
    ]);
    expect(readDashboard(database, '2026-04').categorySpending).toEqual([
      { categoryId: 'expense-groceries', categoryName: 'Groceries', amountMinor: 10 },
    ]);
    expect(readDashboard(database, '2026-05').categorySpending).toEqual([]);
  });

  it('defaults to the local host calendar month and rejects invalid input before querying', () => {
    const database = openDatabase();
    addAccount(database, 'a');
    addTransaction(database, 'march', 'a', 'expense', 25, '2026-03-31');
    const localClock = new Date(2026, 2, 31, 23, 59, 59);
    expect(parseDashboardMonth(undefined, localClock)).toBe('2026-03');
    expect(readDashboard(database, undefined, localClock).expensesMinor).toBe(25);

    for (const invalid of [
      '',
      '2026-00',
      '2026-13',
      '0000-01',
      '2026-2',
      '2026-02-01',
      202602,
      null,
    ]) {
      expect(() => readDashboard(database, invalid)).toThrow();
    }
  });

  it('fails explicitly when total or monthly aggregates exceed safe integers', () => {
    const database = openDatabase();
    addAccount(database, 'first', Number.MAX_SAFE_INTEGER);
    addAccount(database, 'second', 1);
    expect(() => readDashboard(database, '2026-03')).toThrow(/Total balance.*safe integer/);

    database.$client.prepare('UPDATE accounts SET opening_balance_minor = 0').run();
    addTransaction(database, 'offset', 'first', 'income', Number.MAX_SAFE_INTEGER, '2026-03-01');
    addTransaction(database, 'max', 'first', 'expense', Number.MAX_SAFE_INTEGER, '2026-03-01');
    addTransaction(database, 'one', 'second', 'expense', 1, '2026-03-02');
    expect(() => readDashboard(database, '2026-03')).toThrow(/Monthly expenses.*safe integer/);
  });

  it('authorizes before the database import and lets an allowed session read', async () => {
    const database = openDatabase();
    addAccount(database, 'allowed', 100);
    databaseModuleMock.db = database;
    authMock.mockResolvedValue({ user: { id: 'entra-subject', email: 'allowed@example.test' } });
    await expect(getDashboardForUser('2026-03')).resolves.toMatchObject({ totalBalanceMinor: 100 });

    databaseModuleMock.db = undefined;
    for (const session of [undefined, null, { user: { email: 'denied@example.test' } }]) {
      authMock.mockResolvedValue(session);
      await expect(getDashboardForUser('2026-03')).rejects.toBeInstanceOf(AccessDeniedError);
      expect(databaseModuleMock.db).toBeUndefined();
    }
  });
});
