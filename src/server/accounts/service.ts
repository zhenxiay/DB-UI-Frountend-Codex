import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { AuthenticatedIdentity } from '../../lib/entra-allowlist';
import {
  recordCreateAuditEvent,
  recordDeleteAuditEvent,
  recordUpdateAuditEvent,
  type AuditDatabase,
} from '../audit/service';
import { accounts, schema, transactions } from '../db/schema';

const accountInputSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required.').max(120),
  typeLabel: z.string().trim().min(1, 'Account type is required.').max(80),
  openingBalanceMinor: z
    .number()
    .int('Opening balance must be an integer amount in cents.')
    .refine(Number.isSafeInteger, 'Opening balance must be a safe integer amount in cents.'),
});

const accountIdSchema = z.string().trim().min(1, 'Account ID is required.');

export type AccountInput = z.infer<typeof accountInputSchema>;
export type AccountDatabase = BetterSQLite3Database<typeof schema>;

export class AccountValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(error: z.ZodError) {
    super('Account validation failed.');
    this.name = 'AccountValidationError';
    this.fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
  }
}

function validateInput(input: unknown): AccountInput {
  const result = accountInputSchema.safeParse(input);
  if (!result.success) throw new AccountValidationError(result.error);
  return result.data;
}

function validateId(id: unknown): string {
  const result = accountIdSchema.safeParse(id);
  if (!result.success) throw new AccountValidationError(result.error);
  return result.data;
}

function now(): Date {
  return new Date();
}

export function createAccountForUser(
  database: AccountDatabase,
  actor: AuthenticatedIdentity,
  input: unknown,
) {
  const values = validateInput(input);
  const timestamp = now();
  const account = {
    id: randomUUID(),
    ...values,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return database.transaction((transaction) => {
    transaction.insert(accounts).values(account).run();
    recordCreateAuditEvent(
      transaction as unknown as AuditDatabase,
      actor,
      'account',
      account.id,
      account,
    );
    return account;
  });
}

export function updateAccountForUser(
  database: AccountDatabase,
  actor: AuthenticatedIdentity,
  id: unknown,
  input: unknown,
) {
  const accountId = validateId(id);
  const values = validateInput(input);
  const before = database.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!before) throw new Error('Account not found.');

  const after = { ...before, ...values, updatedAt: now() };
  return database.transaction((transaction) => {
    transaction
      .update(accounts)
      .set({ ...values, updatedAt: after.updatedAt })
      .where(eq(accounts.id, accountId))
      .run();
    recordUpdateAuditEvent(
      transaction as unknown as AuditDatabase,
      actor,
      'account',
      accountId,
      before,
      after,
    );
    return after;
  });
}

export function deleteAccountForUser(
  database: AccountDatabase,
  actor: AuthenticatedIdentity,
  id: unknown,
) {
  const accountId = validateId(id);
  const account = database.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) throw new Error('Account not found.');
  const dependentTransactions = database
    .select()
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId)))
    .all();

  return database.transaction((transaction) => {
    transaction.delete(transactions).where(eq(transactions.accountId, accountId)).run();
    transaction.delete(accounts).where(eq(accounts.id, accountId)).run();

    for (const dependentTransaction of dependentTransactions) {
      recordDeleteAuditEvent(
        transaction as unknown as AuditDatabase,
        actor,
        'transaction',
        dependentTransaction.id,
        dependentTransaction,
      );
    }
    recordDeleteAuditEvent(
      transaction as unknown as AuditDatabase,
      actor,
      'account',
      accountId,
      account,
    );
    return account;
  });
}

export async function createAccount(input: unknown) {
  const { requireAllowedUser } = await import('../auth/authorization');
  const actor = await requireAllowedUser();
  const { db } = await import('../db');
  return createAccountForUser(db, actor, input);
}

export async function updateAccount(id: unknown, input: unknown) {
  const { requireAllowedUser } = await import('../auth/authorization');
  const actor = await requireAllowedUser();
  const { db } = await import('../db');
  return updateAccountForUser(db, actor, id, input);
}

export async function deleteAccount(id: unknown) {
  const { requireAllowedUser } = await import('../auth/authorization');
  const actor = await requireAllowedUser();
  const { db } = await import('../db');
  return deleteAccountForUser(db, actor, id);
}

export { accountInputSchema };
