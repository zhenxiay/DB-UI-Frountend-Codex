import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { AuthenticatedIdentity } from '../../lib/entra-allowlist';
import { auditEvents, schema } from '../db/schema';

const actorSchema = z
  .object({
    email: z.string().trim().min(1).optional().nullable(),
    id: z.string().trim().min(1).optional().nullable(),
  })
  .refine((actor) => Boolean(actor.id || actor.email), 'Authenticated identity is required');

const auditEventSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  entityType: z.enum(['account', 'transaction']),
  entityId: z.string().trim().min(1),
  beforeSnapshot: z.unknown().nullable().optional(),
  afterSnapshot: z.unknown().nullable().optional(),
});

export type AuditDatabase = BetterSQLite3Database<typeof schema>;
export type AuditAction = z.infer<typeof auditEventSchema>['action'];
export type AuditEntityType = z.infer<typeof auditEventSchema>['entityType'];

export type AuditEventInput = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  beforeSnapshot?: unknown | null;
  afterSnapshot?: unknown | null;
  occurredAt?: Date;
  id?: string;
};

function serializeSnapshot(value: unknown | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Audit snapshots must be JSON-serializable');
  return serialized;
}

function getActorIdentity(actor: AuthenticatedIdentity): string {
  const parsed = actorSchema.parse(actor);
  // The provider subject is stable; email is a fallback for identities without a subject.
  return (parsed.id ?? parsed.email)!.trim();
}

/** Writes one immutable audit snapshot using the authenticated session identity. */
export function recordAuditEvent(
  database: AuditDatabase,
  actor: AuthenticatedIdentity,
  input: AuditEventInput,
) {
  const event = auditEventSchema.parse(input);
  return database
    .insert(auditEvents)
    .values({
      id: input.id ?? randomUUID(),
      occurredAt: input.occurredAt ?? new Date(),
      actorIdentity: getActorIdentity(actor),
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      beforeSnapshot: serializeSnapshot(event.beforeSnapshot),
      afterSnapshot: serializeSnapshot(event.afterSnapshot),
    })
    .returning()
    .get();
}

export function recordCreateAuditEvent(
  database: AuditDatabase,
  actor: AuthenticatedIdentity,
  entityType: AuditEntityType,
  entityId: string,
  afterSnapshot: unknown,
) {
  return recordAuditEvent(database, actor, {
    action: 'create',
    entityType,
    entityId,
    afterSnapshot,
  });
}

export function recordUpdateAuditEvent(
  database: AuditDatabase,
  actor: AuthenticatedIdentity,
  entityType: AuditEntityType,
  entityId: string,
  beforeSnapshot: unknown,
  afterSnapshot: unknown,
) {
  return recordAuditEvent(database, actor, {
    action: 'update',
    entityType,
    entityId,
    beforeSnapshot,
    afterSnapshot,
  });
}

export function recordDeleteAuditEvent(
  database: AuditDatabase,
  actor: AuthenticatedIdentity,
  entityType: AuditEntityType,
  entityId: string,
  beforeSnapshot: unknown,
) {
  return recordAuditEvent(database, actor, {
    action: 'delete',
    entityType,
    entityId,
    beforeSnapshot,
  });
}
