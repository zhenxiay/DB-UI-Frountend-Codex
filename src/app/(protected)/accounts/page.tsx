import { AccountManagement } from '../../../components/account-management';
import { getAccountsForUser } from '../../../server/accounts/query';
export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const accounts = await getAccountsForUser();
  return (
    <>
      <h1>Accounts</h1>
      <p>Manage your accounts and opening balances.</p>
      <AccountManagement initialAccounts={accounts} />
    </>
  );
}
