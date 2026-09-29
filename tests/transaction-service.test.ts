import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createTransactionForUser,
  deleteTransactionForUser,
  TransactionValidationError,
  updateTransactionForUser,
} from '../src/server/transactions/service';
import { schema } from '../src/server/db/schema';

const temporaryDirectories: string[] = [];
const openClients: Array<{ close: () => void }> = [];
const actor = { id: 'entra-subject-1', email: 'user@example.test' };

afterEach(() => {
  for (const client of openClients.splice(0)) client.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function openDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-transactions-'));
  temporaryDirectories.push(directory);
  const sqlite = new Database(join(directory, 'transactions.sqlite'));
  openClients.push(sqlite);
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: join(process.cwd(), 'drizzle') });
  database
    .insert(schema.accounts)
    .values({
      id: 'account-1',
      name: 'Main account',
      typeLabel: 'Checking',
      openingBalanceMinor: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  return database;
}

const validInput = {
  accountId: 'account-1',
  categoryId: 'expense-groceries',
  type: 'expense' as const,
  amountMinor: 2500,
  transactionDate: '2026-02-28',
  entryDate: '2026-03-01',
  payee: 'Shop',
  notes: 'Weekly groceries',
};

describe('transaction mutations', () => {
  it('rejects invalid dates, amounts, and references before writing anything', () => {
    const database = openDatabase();
    expect(() =>
      createTransactionForUser(database, actor, {
        ...validInput,
        amountMinor: 0,
        transactionDate: '2026-02-30',
        categoryId: 'missing-category',
      }),
    ).toThrow(TransactionValidationError);
    expect(() => createTransactionForUser(database, actor, validInput)).not.toThrow();
    expect(() =>
      createTransactionForUser(database, actor, {
        ...validInput,
        accountId: 'missing-account',
      }),
    ).toThrow('Account not found.');
    expect(() =>
      createTransactionForUser(database, actor, {
        ...validInput,
        categoryId: 'missing-category',
      }),
    ).toThrow('Category not found.');
  });

  it('creates, updates, and deletes with exactly one audit event per mutation', () => {
    const database = openDatabase();
    const created = createTransactionForUser(database, actor, validInput);
    const updated = updateTransactionForUser(database, actor, created.id, {
      ...validInput,
      type: 'income',
      amountMinor: 5000,
      payee: undefined,
    });
    const deleted = deleteTransactionForUser(database, actor, created.id);

    expect(updated.amountMinor).toBe(5000);
    expect(deleted.id).toBe(created.id);
    expect(database.select().from(schema.transactions).all()).toEqual([]);
    const audits = database.$client
      .prepare(
        'SELECT action, entity_type, entity_id, actor_identity, before_snapshot, after_snapshot FROM audit_events ORDER BY rowid',
      )
      .all() as Array<Record<string, string | null>>;
    expect(audits).toHaveLength(3);
    expect(audits.map((audit) => audit.action)).toEqual(['create', 'update', 'delete']);
    expect(audits.every((audit) => audit.entity_type === 'transaction')).toBe(true);
    expect(audits.every((audit) => audit.entity_id === created.id)).toBe(true);
    expect(audits.every((audit) => audit.actor_identity === actor.id)).toBe(true);
    expect(audits[2].before_snapshot).toContain(created.id);
  });

  it('rolls back a transaction when its audit event cannot be written', () => {
    const database = openDatabase();
    database.$client.exec(`
      CREATE TRIGGER reject_audit_events
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit failure');
      END;
    `);
    expect(() => createTransactionForUser(database, actor, validInput)).toThrow('audit failure');
    expect(database.select().from(schema.transactions).all()).toEqual([]);
  });
});
