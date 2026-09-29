export const dynamic = 'force-dynamic';

import { TransactionForm } from '../../../components/transaction-form';
import { getTransactionReferences } from '../../../server/transactions/query';

export default async function TransactionsPage() {
  const references = await getTransactionReferences();
  return (
    <>
      <h1>Transactions</h1>
      <p>Record your income and spending.</p>
      <TransactionForm {...references} />
    </>
  );
}
