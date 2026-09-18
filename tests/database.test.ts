import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getSqlitePath } from '../src/server/db/env';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('local SQLite connection', () => {
  it('opens a test-owned temporary database', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'personal-finance-db-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'test.sqlite');

    process.env.SQLITE_PATH = databasePath;
    const { db: database } = await import('../src/server/db');

    expect(databasePath).toContain(directory);
    expect(database).toBeDefined();
    database.$client.close();
    delete process.env.SQLITE_PATH;
  }, 15_000);

  it('rejects a missing configured path with an actionable error', () => {
    expect(() => getSqlitePath({ SQLITE_PATH: '  ' })).toThrow('SQLITE_PATH');
  });
});
