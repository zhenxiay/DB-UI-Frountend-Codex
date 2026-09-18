import 'server-only';

import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { categories, schema } from './schema';

export const builtInCategories = [
  { id: 'income-salary', name: 'Salary', kind: 'income' },
  { id: 'income-freelance', name: 'Freelance and side income', kind: 'income' },
  { id: 'income-interest', name: 'Interest and dividends', kind: 'income' },
  { id: 'income-refunds', name: 'Refunds', kind: 'income' },
  { id: 'income-other', name: 'Other income', kind: 'income' },
  { id: 'expense-housing', name: 'Housing', kind: 'expense' },
  { id: 'expense-utilities', name: 'Utilities', kind: 'expense' },
  { id: 'expense-groceries', name: 'Groceries', kind: 'expense' },
  { id: 'expense-dining', name: 'Dining out', kind: 'expense' },
  { id: 'expense-transport', name: 'Transport', kind: 'expense' },
  { id: 'expense-health', name: 'Health', kind: 'expense' },
  { id: 'expense-insurance', name: 'Insurance', kind: 'expense' },
  { id: 'expense-communication', name: 'Communication', kind: 'expense' },
  { id: 'expense-education', name: 'Education', kind: 'expense' },
  { id: 'expense-leisure', name: 'Leisure', kind: 'expense' },
  { id: 'expense-clothing', name: 'Clothing', kind: 'expense' },
  { id: 'expense-personal-care', name: 'Personal care', kind: 'expense' },
  { id: 'expense-gifts', name: 'Gifts and donations', kind: 'expense' },
  { id: 'expense-taxes', name: 'Taxes and fees', kind: 'expense' },
  { id: 'expense-other', name: 'Other expenses', kind: 'expense' },
] as const;

type Database = BetterSQLite3Database<typeof schema>;

/** Insert the application-owned categories without ever changing existing rows. */
export function seedBuiltInCategories(database: Database): void {
  database
    .insert(categories)
    .values([...builtInCategories])
    .onConflictDoNothing({ target: categories.id })
    .run();
}

/** SQL used by migrations and tests to verify the seed remains insert-only. */
export const builtInCategoryCount = sql<number>`(select count(*) from ${categories})`;
