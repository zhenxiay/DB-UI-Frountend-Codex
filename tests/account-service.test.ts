import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AccountValidationError,
  createAccountForUser,
  deleteAccountForUser,
  updateAccountForUser,
} from '../src/server/accounts/service';
import { schema, transactions } from '../src/server/db/schema';

const temporaryDirectories: string[] = [];
const openClients: Array<{ close: () => void }> = [];
const actor = { id: 'entra-subject-1', email: 'user@example.test' };

afterEach(() => {
  for (const client of openClients.splice(0)) {
    client.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function openDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-accounts-'));
  temporaryDirectories.push(directory);
  const sqlite = new Database(join(directory, 'accounts.sqlite'));
  openClients.push(sqlite);
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: join(process.cwd(), 'drizzle') });
  return database;
}

describe('account mutations', () => {
  it('rejects invalid names and opening balances with field errors', () => {
    const database = openDatabase();
    expect(() =>
      createAccountForUser(database, actor, {
        name: ' ',
        typeLabel: '',
        openingBalanceMinor: 10.5,
      }),
    ).toThrow(AccountValidationError);

    try {
      createAccountForUser(database, actor, { name: '', typeLabel: '', openingBalanceMinor: 1.2 });
    } catch (error) {
      expect(error).toMatchObject({
        fieldErrors: {
          name: expect.any(Array),
          typeLabel: expect.any(Array),
          openingBalanceMinor: expect.any(Array),
        },
      });
    }
    expect(() =>
      createAccountForUser(database, actor, {
        name: 'Unsafe amount',
        typeLabel: 'Checking',
        openingBalanceMinor: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow(AccountValidationError);
    expect(database.select().from(schema.accounts).all()).toEqual([]);
    expect(database.select().from(schema.auditEvents).all()).toEqual([]);
  });

  it('creates and updates an account with an audit snapshot', () => {
    const database = openDatabase();
    const created = createAccountForUser(database, actor, {
      name: 'Main account',
      typeLabel: 'Checking',
      openingBalanceMinor: 125050,
    });
    expect(created.openingBalanceMinor).toBe(125050);
    const updated = updateAccountForUser(database, actor, created.id, {
      name: 'Daily account',
      typeLabel: 'Checking',
      openingBalanceMinor: -125000,
    });

    expect(updated.name).toBe('Daily account');
    expect(
      database.$client
        .prepare(
          'SELECT action, entity_type, before_snapshot, after_snapshot FROM audit_events ORDER BY rowid',
        )
        .all(),
    ).toHaveLength(2);
    const auditRows = database.$client
      .prepare('SELECT action, before_snapshot, after_snapshot FROM audit_events ORDER BY rowid')
      .all() as Array<{
      action: string;
      before_snapshot: string | null;
      after_snapshot: string | null;
    }>;
    expect(JSON.parse(auditRows[0].after_snapshot!)).toMatchObject({
      id: created.id,
      name: 'Main account',
      openingBalanceMinor: 125050,
    });
    expect(JSON.parse(auditRows[1].before_snapshot!)).toMatchObject({
      id: created.id,
      name: 'Main account',
    });
    expect(JSON.parse(auditRows[1].after_snapshot!)).toMatchObject({
      id: created.id,
      name: 'Daily account',
      openingBalanceMinor: -125000,
    });
    expect(() =>
      updateAccountForUser(database, actor, 'missing-account', {
        name: 'Missing',
        typeLabel: 'Checking',
        openingBalanceMinor: 0,
      }),
    ).toThrow('Account not found.');
    expect(database.$client.prepare('SELECT COUNT(*) AS count FROM audit_events').get()).toEqual({
      count: 2,
    });
  });

  it('deletes an account, dependent transactions, and writes snapshots atomically', () => {
    const database = openDatabase();
    const account = createAccountForUser(database, actor, {
      name: 'Main account',
      typeLabel: 'Checking',
      openingBalanceMinor: 0,
    });
    database
      .insert(transactions)
      .values({
        id: 'transaction-1',
        accountId: account.id,
        categoryId: 'expense-groceries',
        type: 'expense',
        amountMinor: 2500,
        transactionDate: '2026-01-10',
        entryDate: '2026-01-10',
        payee: 'Shop',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    deleteAccountForUser(database, actor, account.id);

    expect(database.select().from(transactions).all()).toEqual([]);
    expect(
      database.$client
        .prepare(
          "SELECT entity_type, action FROM audit_events WHERE action = 'delete' ORDER BY rowid",
        )
        .all(),
    ).toEqual([
      { entity_type: 'transaction', action: 'delete' },
      { entity_type: 'account', action: 'delete' },
    ]);
    const snapshot = database.$client
      .prepare("SELECT before_snapshot FROM audit_events WHERE entity_id = 'transaction-1'")
      .get() as { before_snapshot: string };
    expect(snapshot.before_snapshot).toContain('transaction-1');
  });

  it('rolls back the account mutation when audit recording fails', () => {
    const database = openDatabase();
    database.$client.exec(`
      CREATE TRIGGER reject_audit_events
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit failure');
      END;
    `);

    expect(() =>
      createAccountForUser(database, actor, {
        name: 'Should roll back',
        typeLabel: 'Checking',
        openingBalanceMinor: 100,
      }),
    ).toThrow('audit failure');
    expect(database.select().from(schema.accounts).all()).toEqual([]);
    expect(database.select().from(schema.auditEvents).all()).toEqual([]);
  });
});
