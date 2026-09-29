import 'server-only';

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { AuthenticatedIdentity } from '../../lib/entra-allowlist';
import {
  recordCreateAuditEvent,
  recordDeleteAuditEvent,
  recordUpdateAuditEvent,
  type AuditDatabase,
} from '../audit/service';
import { accounts, categories, schema, transactions } from '../db/schema';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Date must be a valid calendar date.');

const referenceIdSchema = z.string().trim().min(1, 'Reference is required.');
const optionalTextSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.union([z.string().trim().max(240), z.null()]).optional(),
);

const transactionInputSchema = z.object({
  accountId: referenceIdSchema,
  categoryId: referenceIdSchema,
  type: z.enum(['income', 'expense']),
  amountMinor: z
    .number()
    .int('Amount must be an integer amount in cents.')
    .positive('Amount must be greater than zero.')
    .refine(Number.isSafeInteger, 'Amount must be a safe integer amount in cents.'),
  transactionDate: dateSchema,
  entryDate: dateSchema,
  payee: optionalTextSchema,
  notes: optionalTextSchema,
});

const transactionIdSchema = z.string().trim().min(1, 'Transaction ID is required.');

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TransactionDatabase = BetterSQLite3Database<typeof schema>;

export class TransactionValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(error: z.ZodError) {
    super('Transaction validation failed.');
    this.name = 'TransactionValidationError';
    this.fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
  }
}

function validateInput(input: unknown): TransactionInput {
  const result = transactionInputSchema.safeParse(input);
  if (!result.success) throw new TransactionValidationError(result.error);
  return result.data;
}

function validateId(id: unknown): string {
  const result = transactionIdSchema.safeParse(id);
  if (!result.success) throw new TransactionValidationError(result.error);
  return result.data;
}

function assertReferencesExist(
  database: TransactionDatabase,
  accountId: string,
  categoryId: string,
) {
  if (
    !database.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).get()
  ) {
    throw new Error('Account not found.');
  }
  if (
    !database
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .get()
  ) {
    throw new Error('Category not found.');
  }
}

function now(): Date {
  return new Date();
}

export function createTransactionForUser(
  database: TransactionDatabase,
  actor: AuthenticatedIdentity,
  input: unknown,
) {
  const values = validateInput(input);
  const timestamp = now();
  const transaction = {
    id: randomUUID(),
    ...values,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return database.transaction((databaseTransaction) => {
    assertReferencesExist(
      databaseTransaction as unknown as TransactionDatabase,
      values.accountId,
      values.categoryId,
    );
    databaseTransaction.insert(transactions).values(transaction).run();
    recordCreateAuditEvent(
      databaseTransaction as unknown as AuditDatabase,
      actor,
      'transaction',
      transaction.id,
      transaction,
    );
    return transaction;
  });
}

export function updateTransactionForUser(
  database: TransactionDatabase,
  actor: AuthenticatedIdentity,
  id: unknown,
  input: unknown,
) {
  const transactionId = validateId(id);
  const values = validateInput(input);

  return database.transaction((databaseTransaction) => {
    const before = databaseTransaction
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .get();
    if (!before) throw new Error('Transaction not found.');
    assertReferencesExist(
      databaseTransaction as unknown as TransactionDatabase,
      values.accountId,
      values.categoryId,
    );

    const after = { ...before, ...values, updatedAt: now() };
    databaseTransaction
      .update(transactions)
      .set({ ...values, updatedAt: after.updatedAt })
      .where(eq(transactions.id, transactionId))
      .run();
    recordUpdateAuditEvent(
      databaseTransaction as unknown as AuditDatabase,
      actor,
      'transaction',
      transactionId,
      before,
      after,
    );
    return after;
  });
}

export function deleteTransactionForUser(
  database: TransactionDatabase,
  actor: AuthenticatedIdentity,
  id: unknown,
) {
  const transactionId = validateId(id);

  return database.transaction((databaseTransaction) => {
    const transaction = databaseTransaction
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .get();
    if (!transaction) throw new Error('Transaction not found.');

    databaseTransaction.delete(transactions).where(eq(transactions.id, transactionId)).run();
    recordDeleteAuditEvent(
      databaseTransaction as unknown as AuditDatabase,
      actor,
      'transaction',
      transactionId,
      transaction,
    );
    return transaction;
  });
}

export async function createTransaction(input: unknown) {
  const { requireAllowedUser } = await import('../auth/authorization');
  const actor = await requireAllowedUser();
  const { db } = await import('../db');
  return createTransactionForUser(db, actor, input);
}

export async function updateTransaction(id: unknown, input: unknown) {
  const { requireAllowedUser } = await import('../auth/authorization');
  const actor = await requireAllowedUser();
  const { db } = await import('../db');
  return updateTransactionForUser(db, actor, id, input);
}

export async function deleteTransaction(id: unknown) {
  const { requireAllowedUser } = await import('../auth/authorization');
  const actor = await requireAllowedUser();
  const { db } = await import('../db');
  return deleteTransactionForUser(db, actor, id);
}

export { transactionInputSchema };
