import 'server-only';
import type { AccountDatabase } from './service';
import { accounts, transactions } from '../db/schema';

export type AccountListItem = {
  id: string;
  name: string;
  typeLabel: string;
  openingBalanceMinor: number;
  currentBalanceMinor: number;
};

export function listAccounts(database: AccountDatabase): AccountListItem[] {
  const rows = database.select().from(accounts).all();
  const transactionRows = database.select().from(transactions).all();
  const movementByAccount = new Map<string, number>();
  for (const transaction of transactionRows) {
    const signedAmount = transaction.type === 'income' ? transaction.amountMinor : -transaction.amountMinor;
    movementByAccount.set(transaction.accountId, (movementByAccount.get(transaction.accountId) ?? 0) + signedAmount);
  }
  return rows.map((account) => ({
    id: account.id,
    name: account.name,
    typeLabel: account.typeLabel,
    openingBalanceMinor: account.openingBalanceMinor,
    currentBalanceMinor: account.openingBalanceMinor + (movementByAccount.get(account.id) ?? 0),
  }));
}

export async function getAccountsForUser(): Promise<AccountListItem[]> {
  const { requireAllowedUser } = await import('../auth/authorization');
  await requireAllowedUser();
  const { db } = await import('../db');
  return listAccounts(db);
}
