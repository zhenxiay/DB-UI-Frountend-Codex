import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  recordCreateAuditEvent,
  recordDeleteAuditEvent,
  recordUpdateAuditEvent,
} from '../src/server/audit/service';
import { schema } from '../src/server/db/schema';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function openDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-audit-'));
  temporaryDirectories.push(directory);
  const sqlite = new Database(join(directory, 'audit.sqlite'));
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: join(process.cwd(), 'drizzle') });
  return database;
}

describe('audit event service', () => {
  it('records create, update, and delete snapshots with the authenticated actor', () => {
    const database = openDatabase();
    const actor = { id: 'entra-subject-1', email: 'user@example.test' };

    recordCreateAuditEvent(database, actor, 'account', 'account-1', { name: 'Main' });
    recordUpdateAuditEvent(
      database,
      actor,
      'account',
      'account-1',
      { name: 'Main' },
      { name: 'Daily' },
    );
    recordDeleteAuditEvent(database, actor, 'account', 'account-1', {
      id: 'account-1',
      name: 'Daily',
    });

    const events = database.$client
      .prepare(
        'SELECT actor_identity, action, entity_type, entity_id, before_snapshot, after_snapshot FROM audit_events ORDER BY rowid',
      )
      .all();
    expect(events).toEqual([
      {
        actor_identity: 'entra-subject-1',
        action: 'create',
        entity_type: 'account',
        entity_id: 'account-1',
        before_snapshot: null,
        after_snapshot: '{"name":"Main"}',
      },
      {
        actor_identity: 'entra-subject-1',
        action: 'update',
        entity_type: 'account',
        entity_id: 'account-1',
        before_snapshot: '{"name":"Main"}',
        after_snapshot: '{"name":"Daily"}',
      },
      {
        actor_identity: 'entra-subject-1',
        action: 'delete',
        entity_type: 'account',
        entity_id: 'account-1',
        before_snapshot: '{"id":"account-1","name":"Daily"}',
        after_snapshot: null,
      },
    ]);
    database.$client.close();
  });

  it('does not expose update or delete operations for audit rows', () => {
    const database = openDatabase();
    expect((recordCreateAuditEvent as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((recordCreateAuditEvent as unknown as Record<string, unknown>).delete).toBeUndefined();
    database.$client.close();
  });

  it('rejects an identity without an Entra subject or email', () => {
    const database = openDatabase();
    expect(() => recordCreateAuditEvent(database, {}, 'account', 'account-1', {})).toThrow(
      'Authenticated identity is required',
    );
    database.$client.close();
  });
});
