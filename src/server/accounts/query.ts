import 'server-only';
import type { AccountDatabase } from './service';
import { listCalculatedAccountBalances, type CalculatedAccountBalance } from './balance';

export type AccountListItem = CalculatedAccountBalance;

export function listAccounts(database: AccountDatabase): AccountListItem[] {
  return listCalculatedAccountBalances(database);
}

export async function getAccountsForUser(): Promise<AccountListItem[]> {
  const { requireAllowedUser } = await import('../auth/authorization');
  await requireAllowedUser();
  const { db } = await import('../db');
  return listAccounts(db);
}
