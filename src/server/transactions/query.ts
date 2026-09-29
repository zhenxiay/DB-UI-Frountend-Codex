import 'server-only';

import { asc } from 'drizzle-orm';
import { accounts, categories, schema } from '../db/schema';
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
