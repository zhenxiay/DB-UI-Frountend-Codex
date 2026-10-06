export const dynamic = 'force-dynamic';

import { TransactionBrowser } from '../../../components/transaction-browser';
import {
  getTransactionReferences,
  getTransactionsForUser,
  parseTransactionBrowseQuery,
  type TransactionBrowseQuery,
} from '../../../server/transactions/query';

type SearchParameters = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function browseQueryFromSearchParameters(parameters: SearchParameters): TransactionBrowseQuery {
  return parseTransactionBrowseQuery({
    search: firstValue(parameters.search),
    startDate: firstValue(parameters.startDate),
    endDate: firstValue(parameters.endDate),
    accountId: firstValue(parameters.accountId),
    categoryId: firstValue(parameters.categoryId),
    sortBy: firstValue(parameters.sortBy),
    sortDirection: firstValue(parameters.sortDirection),
  });
}

export default async function TransactionsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParameters> }>) {
  const parameters = await searchParams;
  const query = browseQueryFromSearchParameters(parameters);
  const [references, transactions] = await Promise.all([
    getTransactionReferences(),
    getTransactionsForUser(query),
  ]);
  return (
    <TransactionBrowser {...references} initialCreate={firstValue(parameters.create) === '1'} query={query} transactions={transactions} />
  );
}
