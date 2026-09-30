// @vitest-environment node

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAllowedUserMock = vi.hoisted(() => vi.fn());
const databaseModuleMock = vi.hoisted(() => ({ db: undefined }));

vi.mock('../src/server/auth/authorization', () => ({
  requireAllowedUser: requireAllowedUserMock,
}));
vi.mock('../src/server/db', () => databaseModuleMock);

import {
  getTransactionsForUser,
  listTransactions,
  TransactionBrowseQueryValidationError,
} from '../src/server/transactions/query';
import { schema } from '../src/server/db/schema';

const temporaryDirectories: string[] = [];
const openClients: Database[] = [];

afterEach(() => {
  requireAllowedUserMock.mockReset();
  for (const sqlite of openClients.splice(0)) sqlite.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function openDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-transaction-query-'));
  temporaryDirectories.push(directory);
  const sqlite = new Database(join(directory, 'transactions.sqlite'));
  openClients.push(sqlite);
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: join(process.cwd(), 'drizzle') });
  database
    .insert(schema.accounts)
    .values([
      {
        id: 'account-main',
        name: 'Main account',
        typeLabel: 'Checking',
        openingBalanceMinor: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'account-savings',
        name: 'Savings account',
        typeLabel: 'Savings',
        openingBalanceMinor: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    .run();
  database
    .insert(schema.transactions)
    .values([
      {
        id: 'grocery-transaction',
        accountId: 'account-main',
        categoryId: 'expense-groceries',
        type: 'expense',
        amountMinor: 3250,
        transactionDate: '2026-03-10',
        entryDate: '2026-03-10',
        payee: 'Supermarket',
        notes: 'Weekly food shop',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'salary-transaction',
        accountId: 'account-main',
        categoryId: 'income-salary',
        type: 'income',
        amountMinor: 240000,
        transactionDate: '2026-03-05',
        entryDate: '2026-03-05',
        payee: 'Example employer',
        notes: 'March salary',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'dining-transaction',
        accountId: 'account-savings',
        categoryId: 'expense-dining',
        type: 'expense',
        amountMinor: 1800,
        transactionDate: '2026-02-28',
        entryDate: '2026-03-01',
        payee: 'Cafe',
        notes: 'Morning coffee',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    .run();
  return database;
}

describe('transaction browsing queries', () => {
  it('returns joined display data and defaults to newest transaction date first', () => {
    const result = listTransactions(openDatabase());

    expect(result.map((transaction) => transaction.id)).toEqual([
      'grocery-transaction',
      'salary-transaction',
      'dining-transaction',
    ]);
    expect(result[0]).toMatchObject({
      accountName: 'Main account',
      categoryName: 'Groceries',
      amountMinor: 3250,
    });
  });

  it.each([
    ['text search', { search: 'COFFEE' }, ['dining-transaction']],
    ['start date', { startDate: '2026-03-01' }, ['grocery-transaction', 'salary-transaction']],
    ['end date', { endDate: '2026-02-28' }, ['dining-transaction']],
    ['account', { accountId: 'account-savings' }, ['dining-transaction']],
    ['category', { categoryId: 'income-salary' }, ['salary-transaction']],
  ])('filters by %s', (_label, input, expectedIds) => {
    const result = listTransactions(openDatabase(), input);
    expect(result.map((transaction) => transaction.id)).toEqual(expectedIds);
  });

  it('combines every filter with AND semantics', () => {
    const result = listTransactions(openDatabase(), {
      search: 'food',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      accountId: 'account-main',
      categoryId: 'expense-groceries',
    });

    expect(result.map((transaction) => transaction.id)).toEqual(['grocery-transaction']);
  });

  it('supports allowlisted sorting and returns an empty result when nothing matches', () => {
    const database = openDatabase();
    expect(
      listTransactions(database, { sortBy: 'amountMinor', sortDirection: 'asc' }).map(
        (transaction) => transaction.id,
      ),
    ).toEqual(['dining-transaction', 'grocery-transaction', 'salary-transaction']);
    expect(listTransactions(database, { search: 'does not exist' })).toEqual([]);
  });

  it.each([
    { sortBy: 'DROP TABLE transactions' },
    { sortDirection: 'sideways' },
    { accountId: '' },
    { startDate: '2026-02-30' },
    { startDate: '2026-03-02', endDate: '2026-03-01' },
    { unexpected: 'value' },
  ])('rejects invalid browse parameters: %j', (input) => {
    expect(() => listTransactions(openDatabase(), input)).toThrow(
      TransactionBrowseQueryValidationError,
    );
  });

  it('does not open a database for an unauthorized request', async () => {
    requireAllowedUserMock.mockRejectedValue(new Error('Access denied'));

    await expect(getTransactionsForUser()).rejects.toThrow('Access denied');
    expect(databaseModuleMock.db).toBeUndefined();
  });
});
