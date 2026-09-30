'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { TransactionForm } from './transaction-form';
import { deleteTransaction } from '../server/transactions/actions';
import type {
  TransactionBrowseItem,
  TransactionBrowseQuery,
  TransactionEditValues,
  TransactionReferenceData,
} from '../server/transactions/query';

type Props = Readonly<
  TransactionReferenceData & {
    transactions: TransactionBrowseItem[];
    query: TransactionBrowseQuery;
  }
>;

type FilterValues = Pick<
  TransactionBrowseQuery,
  'search' | 'startDate' | 'endDate' | 'accountId' | 'categoryId'
>;

const defaultFilters: FilterValues = {
  search: undefined,
  startDate: undefined,
  endDate: undefined,
  accountId: undefined,
  categoryId: undefined,
};

const money = (minor: number, type: string) => {
  const value = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
    minor / 100,
  );
  return type === 'expense' ? `−${value}` : `+${value}`;
};

function toDisplayDate(value: string | undefined): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function toIsoDate(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(`${year}-${month}-${day}`)
    ? `${year}-${month}-${day}`
    : undefined;
}

function transactionDescription(transaction: TransactionBrowseItem): string {
  const parts = [
    transaction.accountName,
    toDisplayDate(transaction.transactionDate),
    money(transaction.amountMinor, transaction.type),
  ];
  if (transaction.payee) parts.push(transaction.payee);
  return parts.join(', ');
}

function toEditValues(transaction: TransactionBrowseItem): TransactionEditValues | undefined {
  if (transaction.type !== 'income' && transaction.type !== 'expense') return undefined;

  return {
    id: transaction.id,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    type: transaction.type,
    amountMinor: transaction.amountMinor,
    transactionDate: transaction.transactionDate,
    entryDate: transaction.entryDate,
    payee: transaction.payee,
    notes: transaction.notes,
  };
}

function filtersFromQuery(query: TransactionBrowseQuery): FilterValues {
  return {
    search: query.search,
    startDate: query.startDate,
    endDate: query.endDate,
    accountId: query.accountId,
    categoryId: query.categoryId,
  };
}

function activeFilterText(
  query: TransactionBrowseQuery,
  accounts: Props['accounts'],
  categories: Props['categories'],
) {
  const filters = [
    query.search ? `search “${query.search}”` : undefined,
    query.startDate ? `from ${toDisplayDate(query.startDate)}` : undefined,
    query.endDate ? `to ${toDisplayDate(query.endDate)}` : undefined,
    query.accountId
      ? `account ${accounts.find((account) => account.id === query.accountId)?.name ?? 'selected'}`
      : undefined,
    query.categoryId
      ? `category ${categories.find((category) => category.id === query.categoryId)?.name ?? 'selected'}`
      : undefined,
  ].filter(Boolean);

  return filters.length ? `Active filters: ${filters.join(', ')}.` : 'No filters are active.';
}

export function TransactionBrowser({ accounts, categories, transactions, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<FilterValues>(() => filtersFromQuery(query));
  const [dateError, setDateError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [editingTransaction, setEditingTransaction] = useState<TransactionEditValues>();
  const [pendingDelete, setPendingDelete] = useState<TransactionBrowseItem>();
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteSuccessRef = useRef<HTMLParagraphElement>(null);
  const deleteInFlightRef = useRef(false);
  const dialogWasOpenRef = useRef(false);
  const focusAfterCloseRef = useRef<'delete-button' | 'success'>('delete-button');

  useEffect(() => setFilters(filtersFromQuery(query)), [query]);

  useEffect(() => {
    if (pendingDelete) {
      dialogWasOpenRef.current = true;
      cancelDeleteButtonRef.current?.focus();
      return;
    }

    if (dialogWasOpenRef.current) {
      if (focusAfterCloseRef.current === 'success') deleteSuccessRef.current?.focus();
      else deleteButtonRef.current?.focus();
      dialogWasOpenRef.current = false;
    }
  }, [pendingDelete]);

  useEffect(() => {
    if (isDeletePending) deleteDialogRef.current?.focus();
  }, [isDeletePending]);

  const activeText = useMemo(
    () => activeFilterText(query, accounts, categories),
    [accounts, categories, query],
  );

  const updateFilter = (key: keyof FilterValues, value: string) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
    if (key === 'startDate' || key === 'endDate') setDateError('');
  };

  function navigate(next: TransactionBrowseQuery) {
    const params = new URLSearchParams();
    if (next.search) params.set('search', next.search);
    if (next.startDate) params.set('startDate', next.startDate);
    if (next.endDate) params.set('endDate', next.endDate);
    if (next.accountId) params.set('accountId', next.accountId);
    if (next.categoryId) params.set('categoryId', next.categoryId);
    if (next.sortBy !== 'transactionDate') params.set('sortBy', next.sortBy);
    if (next.sortDirection !== 'desc') params.set('sortDirection', next.sortDirection);
    const search = params.toString();
    startTransition(() => router.push(search ? `${pathname}?${search}` : pathname));
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startDate = toIsoDate(filters.startDate ? toDisplayDate(filters.startDate) : '');
    const endDate = toIsoDate(filters.endDate ? toDisplayDate(filters.endDate) : '');
    if ((filters.startDate && !startDate) || (filters.endDate && !endDate)) {
      setDateError('Enter filter dates as DD.MM.YYYY.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setDateError('The end date must be on or after the start date.');
      return;
    }
    navigate({ ...query, ...filters, startDate, endDate });
  }

  function clearFilters() {
    setFilters(defaultFilters);
    setDateError('');
    navigate({ ...query, ...defaultFilters });
  }

  function changeSort(sortBy: TransactionBrowseQuery['sortBy']) {
    const sortDirection =
      query.sortBy === sortBy ? (query.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
    navigate({ ...query, sortBy, sortDirection });
  }

  const sortLabel = (sortBy: TransactionBrowseQuery['sortBy']) => {
    if (query.sortBy !== sortBy) return 'none';
    return query.sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  function openDeleteDialog(transaction: TransactionBrowseItem, button: HTMLButtonElement) {
    deleteButtonRef.current = button;
    deleteInFlightRef.current = false;
    focusAfterCloseRef.current = 'delete-button';
    setDeleteError('');
    setDeleteSuccess('');
    setPendingDelete(transaction);
  }

  function closeDeleteDialog() {
    if (isDeletePending) return;
    focusAfterCloseRef.current = 'delete-button';
    setDeleteError('');
    setPendingDelete(undefined);
  }

  async function confirmDelete() {
    if (!pendingDelete || deleteInFlightRef.current) return;

    deleteInFlightRef.current = true;
    setIsDeletePending(true);
    setDeleteError('');

    const transaction = pendingDelete;
    const description = transactionDescription(transaction);
    try {
      const result = await deleteTransaction(transaction.id);
      if (!result.success) {
        const detail = result.message ? ` ${result.message}` : '';
        setDeleteError(`Transaction was not deleted.${detail} You can retry or cancel.`);
        return;
      }

      focusAfterCloseRef.current = 'success';
      setDeleteSuccess(`Deleted transaction: ${description}.`);
      setPendingDelete(undefined);
      router.refresh();
    } catch (error) {
      const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
      setDeleteError(`Transaction was not deleted.${detail} You can retry or cancel.`);
    } finally {
      deleteInFlightRef.current = false;
      setIsDeletePending(false);
    }
  }

  function trapDialogFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDeleteDialog();
      return;
    }
    if (event.key !== 'Tab') return;

    const controls =
      deleteDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    if (!controls?.length) {
      event.preventDefault();
      deleteDialogRef.current?.focus();
      return;
    }

    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="transaction-browser">
      <section
        aria-labelledby="transaction-filters-heading"
        className="account-panel"
        inert={Boolean(pendingDelete)}
      >
        <h2 id="transaction-filters-heading">Find transactions</h2>
        <form noValidate onSubmit={applyFilters}>
          <div className="transaction-filter-grid">
            <label htmlFor="transaction-search">
              Search payee or note
              <input
                id="transaction-search"
                value={filters.search ?? ''}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </label>
            <label htmlFor="transaction-start-date">
              From date (DD.MM.YYYY)
              <input
                aria-describedby={dateError ? 'transaction-filter-date-error' : undefined}
                aria-invalid={Boolean(dateError)}
                id="transaction-start-date"
                inputMode="numeric"
                value={toDisplayDate(filters.startDate)}
                onChange={(event) => updateFilter('startDate', event.target.value)}
              />
            </label>
            <label htmlFor="transaction-end-date">
              To date (DD.MM.YYYY)
              <input
                aria-describedby={dateError ? 'transaction-filter-date-error' : undefined}
                aria-invalid={Boolean(dateError)}
                id="transaction-end-date"
                inputMode="numeric"
                value={toDisplayDate(filters.endDate)}
                onChange={(event) => updateFilter('endDate', event.target.value)}
              />
            </label>
            <label htmlFor="transaction-filter-account">
              Account
              <select
                id="transaction-filter-account"
                value={filters.accountId ?? ''}
                onChange={(event) => updateFilter('accountId', event.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="transaction-filter-category">
              Category
              <select
                id="transaction-filter-category"
                value={filters.categoryId ?? ''}
                onChange={(event) => updateFilter('categoryId', event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {dateError && (
            <p className="field-error" id="transaction-filter-date-error" role="alert">
              {dateError}
            </p>
          )}
          <div className="account-form-actions">
            <button disabled={isPending} type="submit">
              Apply filters
            </button>
            <button disabled={isPending} onClick={clearFilters} type="button">
              Clear filters
            </button>
          </div>
        </form>
        <p aria-live="polite" className="transaction-filter-status" role="status">
          {isPending ? 'Loading transactions…' : activeText}
        </p>
      </section>

      {editingTransaction && (
        <div inert={Boolean(pendingDelete)}>
          <TransactionForm
            accounts={accounts}
            categories={categories}
            transaction={editingTransaction}
            onSuccess={() => {
              setEditingTransaction(undefined);
              router.refresh();
            }}
          />
        </div>
      )}

      <section
        aria-labelledby="transaction-list-heading"
        className="account-panel transaction-table-panel"
        inert={Boolean(pendingDelete)}
      >
        <h2 id="transaction-list-heading">Transactions</h2>
        {transactions.length === 0 ? (
          <p className="transaction-empty-state">No transactions match the current filters.</p>
        ) : (
          <div className="transaction-table-scroll">
            <table>
              <thead>
                <tr>
                  <th aria-sort={sortLabel('payee')} scope="col">
                    <button onClick={() => changeSort('payee')} type="button">
                      Payee
                    </button>
                  </th>
                  <th aria-sort={sortLabel('accountName')} scope="col">
                    <button onClick={() => changeSort('accountName')} type="button">
                      Account
                    </button>
                  </th>
                  <th aria-sort={sortLabel('categoryName')} scope="col">
                    <button onClick={() => changeSort('categoryName')} type="button">
                      Category
                    </button>
                  </th>
                  <th aria-sort={sortLabel('transactionDate')} scope="col">
                    <button onClick={() => changeSort('transactionDate')} type="button">
                      Date
                    </button>
                  </th>
                  <th aria-sort={sortLabel('amountMinor')} scope="col">
                    <button onClick={() => changeSort('amountMinor')} type="button">
                      Amount
                    </button>
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.payee || '—'}</td>
                    <td>{transaction.accountName}</td>
                    <td>{transaction.categoryName}</td>
                    <td>{toDisplayDate(transaction.transactionDate)}</td>
                    <td className={transaction.type === 'expense' ? 'negative-money' : undefined}>
                      {money(transaction.amountMinor, transaction.type)}
                    </td>
                    <td>
                      <div className="transaction-row-actions">
                        <button
                          onClick={() => setEditingTransaction(toEditValues(transaction))}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="danger-button"
                          onClick={(event) => openDeleteDialog(transaction, event.currentTarget)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pendingDelete && (
        <div className="confirmation-backdrop">
          <div
            ref={deleteDialogRef}
            aria-labelledby="delete-transaction-title"
            aria-describedby="delete-transaction-description"
            aria-modal="true"
            className="confirmation-dialog"
            onKeyDown={trapDialogFocus}
            role="dialog"
            tabIndex={-1}
          >
            <h2 id="delete-transaction-title">Delete transaction?</h2>
            <p id="delete-transaction-description">
              Delete {transactionDescription(pendingDelete)}? This action cannot be undone.
            </p>
            {deleteError && <p role="alert">{deleteError}</p>}
            <div className="account-form-actions">
              <button disabled={isDeletePending} onClick={confirmDelete} type="button">
                {isDeletePending ? 'Deleting…' : 'Confirm deletion'}
              </button>
              <button
                ref={cancelDeleteButtonRef}
                disabled={isDeletePending}
                onClick={closeDeleteDialog}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteSuccess && (
        <p
          ref={deleteSuccessRef}
          aria-label="Transaction deletion result"
          aria-live="polite"
          className="account-feedback"
          role="status"
          tabIndex={-1}
        >
          {deleteSuccess}
        </p>
      )}
    </div>
  );
}
