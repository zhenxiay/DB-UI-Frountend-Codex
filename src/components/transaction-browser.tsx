'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

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
    initialCreate?: boolean;
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
    query.search ? `Suche „${query.search}“` : undefined,
    query.startDate ? `ab ${toDisplayDate(query.startDate)}` : undefined,
    query.endDate ? `bis ${toDisplayDate(query.endDate)}` : undefined,
    query.accountId
      ? `Konto ${accounts.find((account) => account.id === query.accountId)?.name ?? 'ausgewählt'}`
      : undefined,
    query.categoryId
      ? `Kategorie ${categories.find((category) => category.id === query.categoryId)?.name ?? 'ausgewählt'}`
      : undefined,
  ].filter(Boolean);

  return filters.length ? `Aktive Filter: ${filters.join(', ')}.` : 'Keine Filter aktiv.';
}

export function TransactionBrowser({ accounts, categories, transactions, query, initialCreate = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<FilterValues>(() => filtersFromQuery(query));
  const [dateError, setDateError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [editingTransaction, setEditingTransaction] = useState<TransactionEditValues>();
  const [isCreating, setIsCreating] = useState(initialCreate && accounts.length > 0);
  const [createSuccess, setCreateSuccess] = useState('');
  const [pendingDelete, setPendingDelete] = useState<TransactionBrowseItem>();
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteSuccessRef = useRef<HTMLParagraphElement>(null);
  const createSuccessRef = useRef<HTMLParagraphElement>(null);
  const deleteInFlightRef = useRef(false);
  const dialogWasOpenRef = useRef(false);
  const focusAfterCloseRef = useRef<'delete-button' | 'success'>('delete-button');
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const formOpenerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setFilters(filtersFromQuery(query)), [query]);

  useEffect(() => {
    const open = () => openCreateForm();
    window.addEventListener('saldo:create-transaction', open);
    return () => window.removeEventListener('saldo:create-transaction', open);
  });

  useEffect(() => {
    if (isCreating || editingTransaction) formHeadingRef.current?.focus();
  }, [isCreating, editingTransaction]);

  useEffect(() => {
    if (createSuccess) createSuccessRef.current?.focus();
  }, [createSuccess]);

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
      setDateError('Filterdaten im Format DD.MM.YYYY eingeben.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setDateError('Das Enddatum muss am oder nach dem Anfangsdatum liegen.');
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

  function openCreateForm() {
    formOpenerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : createButtonRef.current;
    setEditingTransaction(undefined);
    setCreateSuccess('');
    setIsCreating(true);
  }

  function openEditForm(transaction: TransactionBrowseItem, button: HTMLButtonElement) {
    formOpenerRef.current = button;
    setIsCreating(false);
    setCreateSuccess('');
    setEditingTransaction(toEditValues(transaction));
  }

  function closeForm() {
    setIsCreating(false);
    setEditingTransaction(undefined);
    requestAnimationFrame(() => formOpenerRef.current?.focus());
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
        setDeleteError(`Transaktion wurde nicht gelöscht.${detail} Sie können es erneut versuchen oder abbrechen.`);
        return;
      }

      focusAfterCloseRef.current = 'success';
      setDeleteSuccess(`Transaktion gelöscht: ${description}.`);
      setPendingDelete(undefined);
      router.refresh();
    } catch (error) {
      const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
      setDeleteError(`Transaktion wurde nicht gelöscht.${detail} Sie können es erneut versuchen oder abbrechen.`);
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
        <h2 id="transaction-filters-heading">Transaktionen finden</h2>
        <form noValidate onSubmit={applyFilters}>
          <div className="transaction-filter-grid">
            <label htmlFor="transaction-search">
              Zahlungsempfänger oder Notiz suchen
              <input
                id="transaction-search"
                value={filters.search ?? ''}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </label>
            <label htmlFor="transaction-start-date">
              Von (DD.MM.YYYY)
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
              Bis (DD.MM.YYYY)
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
              Konto
              <select
                id="transaction-filter-account"
                value={filters.accountId ?? ''}
                onChange={(event) => updateFilter('accountId', event.target.value)}
              >
                <option value="">Alle Konten</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="transaction-filter-category">
              Kategorie
              <select
                id="transaction-filter-category"
                value={filters.categoryId ?? ''}
                onChange={(event) => updateFilter('categoryId', event.target.value)}
              >
                <option value="">Alle Kategorien</option>
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
              Filter anwenden
            </button>
            <button disabled={isPending} onClick={clearFilters} type="button">
              Filter zurücksetzen
            </button>
          </div>
        </form>
        <p aria-live="polite" className="transaction-filter-status" role="status">
          {isPending ? 'Transaktionen werden geladen…' : activeText}
        </p>
      </section>

      <section className="account-panel" inert={Boolean(pendingDelete)}>
        {accounts.length === 0 ? (
          <p>
            Legen Sie zuerst ein Konto an.{' '}
            <Link href="/accounts">Zu den Konten</Link>.
          </p>
        ) : (
          <button className="primary-button" onClick={openCreateForm} ref={createButtonRef} type="button">
            + Transaktion erfassen
          </button>
        )}
        {createSuccess && (
          <p aria-live="polite" className="account-feedback" ref={createSuccessRef} role="status" tabIndex={-1}>
            {createSuccess}
          </p>
        )}
      </section>

      {isCreating && accounts.length > 0 && (
        <div className="transaction-form-container" inert={Boolean(pendingDelete)}>
          <h2 className="sr-only" ref={formHeadingRef} tabIndex={-1}>Neue Transaktion</h2>
          <TransactionForm
            accounts={accounts}
            categories={categories}
            onSuccess={() => {
              setIsCreating(false);
              setCreateSuccess('Transaktion wurde gespeichert.');
              router.refresh();
            }}
          />
          <button className="secondary-button" onClick={closeForm} type="button">
            Abbrechen
          </button>
        </div>
      )}

      {editingTransaction && (
        <div className="transaction-form-container" inert={Boolean(pendingDelete)}>
          <h2 className="sr-only" ref={formHeadingRef} tabIndex={-1}>Transaktion bearbeiten</h2>
          <TransactionForm
            accounts={accounts}
            categories={categories}
            transaction={editingTransaction}
            onSuccess={() => {
              setEditingTransaction(undefined);
              router.refresh();
            }}
          />
          <button className="secondary-button" onClick={closeForm} type="button">
            Abbrechen
          </button>
        </div>
      )}

      <section
        aria-labelledby="transaction-list-heading"
        className="account-panel transaction-table-panel"
        inert={Boolean(pendingDelete)}
      >
        <h2 id="transaction-list-heading">Transaktionen</h2>
        {transactions.length === 0 ? (
          <p className="transaction-empty-state">Keine Transaktionen für die aktuellen Filter.</p>
        ) : (
          <div className="transaction-table-scroll">
            <table>
              <thead>
                <tr>
                  <th aria-sort={sortLabel('payee')} scope="col">
                    <button onClick={() => changeSort('payee')} type="button">
                      Zahlungsempfänger
                    </button>
                  </th>
                  <th aria-sort={sortLabel('accountName')} scope="col">
                    <button onClick={() => changeSort('accountName')} type="button">
                      Konto
                    </button>
                  </th>
                  <th aria-sort={sortLabel('categoryName')} scope="col">
                    <button onClick={() => changeSort('categoryName')} type="button">
                      Kategorie
                    </button>
                  </th>
                  <th aria-sort={sortLabel('transactionDate')} scope="col">
                    <button onClick={() => changeSort('transactionDate')} type="button">
                      Datum
                    </button>
                  </th>
                  <th aria-sort={sortLabel('amountMinor')} scope="col">
                    <button onClick={() => changeSort('amountMinor')} type="button">
                      Betrag
                    </button>
                  </th>
                  <th scope="col">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td><strong>{transaction.payee || 'Ohne Zahlungsempfänger'}</strong>{transaction.notes && <span className="transaction-detail">{transaction.notes}</span>}</td>
                    <td>{transaction.accountName}</td>
                    <td><span className="category-badge">{transaction.categoryName}</span></td>
                    <td>{toDisplayDate(transaction.transactionDate)}</td>
                    <td className={transaction.type === 'expense' ? 'negative-money' : undefined}>
                      {money(transaction.amountMinor, transaction.type)}
                    </td>
                    <td>
                      <div className="transaction-row-actions">
                        <button onClick={(event) => openEditForm(transaction, event.currentTarget)} type="button">
                          Bearbeiten
                        </button>
                        <button
                          className="danger-button"
                          onClick={(event) => openDeleteDialog(transaction, event.currentTarget)}
                          type="button"
                        >
                          Löschen
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
            <h2 id="delete-transaction-title">Transaktion löschen?</h2>
            <p id="delete-transaction-description">
              {transactionDescription(pendingDelete)} löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            {deleteError && <p role="alert">{deleteError}</p>}
            <div className="account-form-actions">
              <button disabled={isDeletePending} onClick={confirmDelete} type="button">
                {isDeletePending ? 'Wird gelöscht…' : 'Löschen bestätigen'}
              </button>
              <button
                ref={cancelDeleteButtonRef}
                disabled={isDeletePending}
                onClick={closeDeleteDialog}
                type="button"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteSuccess && (
        <p
          ref={deleteSuccessRef}
          aria-label="Ergebnis der Transaktionslöschung"
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
