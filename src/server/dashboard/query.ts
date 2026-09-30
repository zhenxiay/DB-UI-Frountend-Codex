import 'server-only';

import { asc, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';

import { listCalculatedAccountBalances, type CalculatedAccountBalance } from '../accounts/balance';
import type { AccountDatabase } from '../accounts/service';
import { accounts, categories, transactions } from '../db/schema';

export type DashboardRecentTransaction = {
  id: string;
  transactionDate: string;
  entryDate: string;
  type: 'income' | 'expense';
  amountMinor: number;
  payee: string | null;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
};

export type DashboardCategorySpending = {
  categoryId: string;
  categoryName: string;
  amountMinor: number;
};

export type DashboardData = {
  month: string;
  accounts: CalculatedAccountBalance[];
  totalBalanceMinor: number;
  recentTransactions: DashboardRecentTransaction[];
  incomeMinor: number;
  expensesMinor: number;
  netMinor: number;
  categorySpending: DashboardCategorySpending[];
};

export const dashboardMonthSchema = z
  .string()
  .regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/, 'Month must be a real YYYY-MM calendar month.');

const maximumSafeMinor = BigInt(Number.MAX_SAFE_INTEGER);

function safeMinor(value: bigint, label: string): number {
  if (value < -maximumSafeMinor || value > maximumSafeMinor) {
    throw new RangeError(`${label} is outside the JavaScript safe integer range.`);
  }
  return Number(value);
}

function storedAmount(value: string): bigint {
  const amount = BigInt(value);
  safeMinor(amount, 'Transaction amount');
  return amount;
}

function transactionType(value: string): 'income' | 'expense' {
  if (value !== 'income' && value !== 'expense') {
    throw new Error('Invalid stored transaction type.');
  }
  return value;
}

/** Uses the app host's local calendar, not the UTC date. */
export function parseDashboardMonth(input: unknown, now: Date = new Date()): string {
  if (input !== undefined) return dashboardMonthSchema.parse(input);
  const month = `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return dashboardMonthSchema.parse(month);
}

function nextMonth(month: string): string | undefined {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  if (year === 9999 && monthNumber === 12) return undefined;
  return monthNumber === 12
    ? `${String(year + 1).padStart(4, '0')}-01-01`
    : `${month.slice(0, 5)}${String(monthNumber + 1).padStart(2, '0')}-01`;
}

/** Typed, presentation-neutral read model; the caller must authorize before calling. */
export function readDashboard(
  database: AccountDatabase,
  monthInput: unknown = undefined,
  now: Date = new Date(),
): DashboardData {
  const month = parseDashboardMonth(monthInput, now);
  const firstDay = `${month}-01`;
  const followingMonth = nextMonth(month);
  const accountBalances = listCalculatedAccountBalances(database);
  const totalBalanceMinor = safeMinor(
    accountBalances.reduce((sum, account) => sum + BigInt(account.currentBalanceMinor), BigInt(0)),
    'Total balance',
  );

  const recentRows = database
    .select({
      id: transactions.id,
      transactionDate: transactions.transactionDate,
      entryDate: transactions.entryDate,
      type: transactions.type,
      amountMinor: sql<string>`cast(${transactions.amountMinor} as text)`,
      payee: transactions.payee,
      accountId: transactions.accountId,
      accountName: accounts.name,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .orderBy(desc(transactions.transactionDate), desc(transactions.entryDate), asc(transactions.id))
    .limit(5)
    .all();

  const recentTransactions: DashboardRecentTransaction[] = recentRows.map((row) => ({
    ...row,
    type: transactionType(row.type),
    amountMinor: safeMinor(storedAmount(row.amountMinor), 'Transaction amount'),
  }));

  const monthRows = database
    .select({
      type: transactions.type,
      amountMinor: sql<string>`cast(${transactions.amountMinor} as text)`,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      followingMonth
        ? sql`${transactions.transactionDate} >= ${firstDay} and ${transactions.transactionDate} < ${followingMonth}`
        : gte(transactions.transactionDate, firstDay),
    )
    .all();

  let income = BigInt(0);
  let expenses = BigInt(0);
  const categoryTotals = new Map<string, { categoryName: string; amount: bigint }>();
  for (const row of monthRows) {
    const amount = storedAmount(row.amountMinor);
    if (transactionType(row.type) === 'income') {
      income += amount;
    } else {
      expenses += amount;
      const previous = categoryTotals.get(row.categoryId);
      categoryTotals.set(row.categoryId, {
        categoryName: row.categoryName,
        amount: (previous?.amount ?? BigInt(0)) + amount,
      });
    }
  }

  return {
    month,
    accounts: accountBalances,
    totalBalanceMinor,
    recentTransactions,
    incomeMinor: safeMinor(income, 'Monthly income'),
    expensesMinor: safeMinor(expenses, 'Monthly expenses'),
    netMinor: safeMinor(income - expenses, 'Monthly net'),
    categorySpending: [...categoryTotals].map(([categoryId, category]) => ({
      categoryId,
      categoryName: category.categoryName,
      amountMinor: safeMinor(category.amount, 'Category spending'),
    })),
  };
}

/** Authorizes before opening the local database or reading financial data. */
export async function getDashboardForUser(monthInput: unknown = undefined): Promise<DashboardData> {
  const { requireAllowedUser } = await import('../auth/authorization');
  await requireAllowedUser();
  const month = parseDashboardMonth(monthInput);
  const { db } = await import('../db');
  return readDashboard(db, month);
}
