import 'server-only';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { getSqlitePath } from './env';

export function createDatabase(databasePath: string) {
  if (!databasePath.trim()) {
    throw new Error('SQLITE_PATH must not be empty');
  }

  const parentDirectory = dirname(databasePath);
  if (parentDirectory && parentDirectory !== '.') {
    mkdirSync(parentDirectory, { recursive: true });
  }

  const sqlite = new Database(databasePath);
  return drizzle(sqlite);
}

export function createConfiguredDatabase(environment: NodeJS.ProcessEnv = process.env) {
  return createDatabase(getSqlitePath(environment));
}

export const db = createConfiguredDatabase();

export { getSqlitePath };
