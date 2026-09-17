// @vitest-environment node

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { builtInCategories, seedBuiltInCategories } from '../src/server/db/categories';
import { schema } from '../src/server/db/schema';

const temporaryDirectories: string[] = [];
const openSqliteDatabases: Database[] = [];

afterEach(() => {
  for (const sqlite of openSqliteDatabases.splice(0)) {
    sqlite.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function openMigratedDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-categories-'));
  temporaryDirectories.push(directory);
  const sqlite = new Database(join(directory, 'categories.sqlite'));
  openSqliteDatabases.push(sqlite);
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: join(process.cwd(), 'drizzle') });
  return database;
}

describe('built-in category seed', () => {
  it('migrates the exact fixed category set', () => {
    const database = openMigratedDatabase();
    const rows = database.$client
      .prepare('SELECT id, name, kind FROM categories ORDER BY id')
      .all();

    expect(rows).toEqual(
      [...builtInCategories].sort((left, right) => left.id.localeCompare(right.id)),
    );
  });

  it('is idempotent and does not overwrite existing category records', () => {
    const database = openMigratedDatabase();
    const sqlite = database.$client;
    sqlite
      .prepare("UPDATE categories SET name = 'My preserved label' WHERE id = 'income-salary'")
      .run();

    seedBuiltInCategories(database);

    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM categories').get()).toEqual({ count: 20 });
    expect(sqlite.prepare('SELECT name FROM categories WHERE id = ?').get('income-salary')).toEqual(
      {
        name: 'My preserved label',
      },
    );
  });
});
