import 'server-only';

import { and, asc, desc, eq, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { accounts, categories, schema, transactions } from '../db/schema';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type TransactionAccountOption = { id: string; name: string };
export type TransactionCategoryOption = { id: string; name: string; kind: string };
export type TransactionReferenceData = {
  accounts: TransactionAccountOption[];
  categories: TransactionCategoryOption[];
};
export type TransactionEditValues = {
  id: string;
  accountId: string;
  categoryId: string;
  type: 'income' | 'expense';
  amountMinor: number;
  transactionDate: string;
  entryDate: string;
  payee: string | null;
  notes: string | null;
};

type Database = BetterSQLite3Database<typeof schema>;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Date must be a valid calendar date.');

const referenceIdSchema = z.string().trim().min(1, 'Reference is required.');

/**
 * Query contract for transaction browsing. Date bounds are inclusive, text
 * search matches payee and notes, and omitted sort options use transactionDate
 * descending (newest first).
 */
export const transactionBrowseQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(240, 'Search must be at most 240 characters.')
      .optional()
      .transform((value) => value || undefined),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    accountId: referenceIdSchema.optional(),
    categoryId: referenceIdSchema.optional(),
    sortBy: z
      .enum(['transactionDate', 'entryDate', 'payee', 'accountName', 'categoryName', 'amountMinor'])
      .default('transactionDate'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must be on or after start date.',
      });
    }
  });

export type TransactionBrowseQuery = z.infer<typeof transactionBrowseQuerySchema>;
export type TransactionBrowseItem = {
  id: string;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  type: string;
  amountMinor: number;
  transactionDate: string;
  entryDate: string;
  payee: string | null;
  notes: string | null;
};

export class TransactionBrowseQueryValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(error: z.ZodError) {
    super('Transaction browse query validation failed.');
    this.name = 'TransactionBrowseQueryValidationError';
    this.fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
  }
}

function parseTransactionBrowseQuery(input: unknown): TransactionBrowseQuery {
  const result = transactionBrowseQuerySchema.safeParse(input === undefined ? {} : input);
  if (!result.success) throw new TransactionBrowseQueryValidationError(result.error);
  return result.data;
}

export function listTransactions(database: Database, input: unknown = {}): TransactionBrowseItem[] {
  const query = parseTransactionBrowseQuery(input);
  const conditions: SQL[] = [];

  if (query.search) {
    const search = query.search.toLowerCase();
    conditions.push(
      or(
        sql`instr(lower(coalesce(${transactions.payee}, '')), ${search}) > 0`,
        sql`instr(lower(coalesce(${transactions.notes}, '')), ${search}) > 0`,
      ) as SQL,
    );
  }
  if (query.startDate) conditions.push(gte(transactions.transactionDate, query.startDate));
  if (query.endDate) conditions.push(lte(transactions.transactionDate, query.endDate));
  if (query.accountId) conditions.push(eq(transactions.accountId, query.accountId));
  if (query.categoryId) conditions.push(eq(transactions.categoryId, query.categoryId));

  const sortColumns = {
    transactionDate: transactions.transactionDate,
    entryDate: transactions.entryDate,
    payee: transactions.payee,
    accountName: accounts.name,
    categoryName: categories.name,
    amountMinor: transactions.amountMinor,
  };
  const sortColumn = sortColumns[query.sortBy];
  const order = query.sortDirection === 'asc' ? asc(sortColumn) : desc(sortColumn);

  return database
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      accountName: accounts.name,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      type: transactions.type,
      amountMinor: transactions.amountMinor,
      transactionDate: transactions.transactionDate,
      entryDate: transactions.entryDate,
      payee: transactions.payee,
      notes: transactions.notes,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(order)
    .all();
}

export function listTransactionReferences(database: Database): TransactionReferenceData {
  return {
    accounts: database
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .orderBy(asc(accounts.name))
      .all(),
    categories: database
      .select({ id: categories.id, name: categories.name, kind: categories.kind })
      .from(categories)
      .orderBy(asc(categories.name))
      .all(),
  };
}

export async function getTransactionReferences(): Promise<TransactionReferenceData> {
  const { requireAllowedUser } = await import('../auth/authorization');
  await requireAllowedUser();
  const { db } = await import('../db');
  return listTransactionReferences(db);
}

/** Authorizes before opening the database and running a browse query. */
export async function getTransactionsForUser(
  input: unknown = {},
): Promise<TransactionBrowseItem[]> {
  const { requireAllowedUser } = await import('../auth/authorization');
  await requireAllowedUser();
  const { db } = await import('../db');
  return listTransactions(db, input);
}
