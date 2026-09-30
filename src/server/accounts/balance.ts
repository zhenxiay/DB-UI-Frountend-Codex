import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { accounts, transactions } from '../db/schema';
import type { AccountDatabase } from './service';

export type CalculatedAccountBalance = {
  id: string;
  name: string;
  typeLabel: string;
  openingBalanceMinor: number;
  currentBalanceMinor: number;
};

const maxSafeMinor = BigInt(Number.MAX_SAFE_INTEGER);

function asSafeNumber(value: bigint, label: string): number {
  if (value < -maxSafeMinor || value > maxSafeMinor) {
    throw new RangeError(`${label} is outside the JavaScript safe integer range.`);
  }
  return Number(value);
}

/** One server-side balance calculation for account lists and dashboard queries. */
export function listCalculatedAccountBalances(
  database: AccountDatabase,
): CalculatedAccountBalance[] {
  // SQLite casts preserve every integer digit before the driver can coerce it
  // to an imprecise JavaScript number. BigInt keeps the running sum exact.
  const rows = database
    .select({
      id: accounts.id,
      name: accounts.name,
      typeLabel: accounts.typeLabel,
      openingBalanceMinor: sql<string>`cast(${accounts.openingBalanceMinor} as text)`,
      transactionType: transactions.type,
      transactionAmountMinor: sql<string | null>`cast(${transactions.amountMinor} as text)`,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .all();

  const balances = new Map<
    string,
    { account: Omit<CalculatedAccountBalance, 'currentBalanceMinor'>; total: bigint }
  >();

  for (const row of rows) {
    let balance = balances.get(row.id);
    if (!balance) {
      const opening = BigInt(row.openingBalanceMinor);
      balance = {
        account: {
          id: row.id,
          name: row.name,
          typeLabel: row.typeLabel,
          openingBalanceMinor: asSafeNumber(opening, 'Opening balance'),
        },
        total: opening,
      };
      balances.set(row.id, balance);
    }

    if (row.transactionAmountMinor !== null) {
      const amount = BigInt(row.transactionAmountMinor);
      asSafeNumber(amount, 'Transaction amount');
      if (row.transactionType === 'income') balance.total += amount;
      else if (row.transactionType === 'expense') balance.total -= amount;
      else throw new Error('Invalid stored transaction type.');
    }
  }

  return [...balances.values()].map(({ account, total }) => ({
    ...account,
    currentBalanceMinor: asSafeNumber(total, 'Account balance'),
  }));
}
