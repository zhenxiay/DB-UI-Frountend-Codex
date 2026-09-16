import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDatabase } from '../src/server/db';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function openMigratedDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-schema-'));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, 'schema.sqlite');
  const database = createDatabase(databasePath);
  migrate(database, { migrationsFolder: join(process.cwd(), 'drizzle') });
  return database;
}

describe('initial SQLite schema', () => {
  it('migrates a clean database with exactly the four application tables', () => {
    const database = openMigratedDatabase();
    const tables = database.$client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '__drizzle%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      'accounts',
      'audit_events',
      'categories',
      'transactions',
    ]);
    database.$client.close();
  });

  it('cascades account deletion while retaining a self-contained audit snapshot', () => {
    const database = openMigratedDatabase();
    const sqlite = database.$client;
    sqlite
      .prepare(
        'INSERT INTO accounts (id, name, type_label, opening_balance_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('account-1', 'Main account', 'checking', 10000, 1, 1);
    sqlite
      .prepare('INSERT INTO categories (id, name, kind) VALUES (?, ?, ?)')
      .run('category-1', 'Salary', 'income');
    sqlite
      .prepare(
        'INSERT INTO transactions (id, account_id, category_id, type, amount_minor, transaction_date, entry_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'transaction-1',
        'account-1',
        'category-1',
        'income',
        5000,
        '2026-09-01',
        '2026-09-02',
        1,
        1,
      );
    sqlite
      .prepare(
        'INSERT INTO audit_events (id, occurred_at, actor_identity, action, entity_type, entity_id, before_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'audit-1',
        1,
        'user@example.test',
        'delete',
        'account',
        'account-1',
        '{"id":"account-1"}',
      );

    sqlite.prepare('DELETE FROM accounts WHERE id = ?').run('account-1');

    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM transactions').get()).toEqual({
      count: 0,
    });
    expect(
      sqlite.prepare('SELECT before_snapshot FROM audit_events WHERE id = ?').get('audit-1'),
    ).toEqual({
      before_snapshot: '{"id":"account-1"}',
    });
    expect(() => sqlite.prepare('DELETE FROM categories WHERE id = ?').run('category-1')).toThrow();
    database.$client.close();
  });
});
