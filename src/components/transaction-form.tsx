'use client';

import { useEffect, useMemo, useState } from 'react';
import { saveTransaction } from '../server/transactions/actions';
import type {
  TransactionCategoryOption,
  TransactionAccountOption,
  TransactionEditValues,
} from '../server/transactions/query';

type Props = Readonly<{
  accounts: TransactionAccountOption[];
  categories: TransactionCategoryOption[];
  transaction?: TransactionEditValues;
  onSuccess?: () => void;
}>;
type FormValues = {
  type: 'income' | 'expense';
  accountId: string;
  categoryId: string;
  amount: string;
  transactionDate: string;
  entryDate: string;
  payee: string;
  notes: string;
};

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function initialValues(transaction?: TransactionEditValues): FormValues {
  return transaction
    ? {
        type: transaction.type,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        amount: (transaction.amountMinor / 100).toFixed(2),
        transactionDate: toDisplayDate(transaction.transactionDate),
        entryDate: toDisplayDate(transaction.entryDate),
        payee: transaction.payee ?? '',
        notes: transaction.notes ?? '',
      }
    : {
        type: 'expense',
        accountId: '',
        categoryId: '',
        amount: '0.00',
        transactionDate: toDisplayDate(today()),
        entryDate: toDisplayDate(today()),
        payee: '',
        notes: '',
      };
}

function toDisplayDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function toIsoDate(value: string): string | undefined {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(`${year}-${month}-${day}`)
    ? `${year}-${month}-${day}`
    : undefined;
}

function toMinorUnits(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return undefined;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || 0);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : undefined;
}

export function TransactionForm({ accounts, categories, transaction, onSuccess }: Props) {
  const [form, setForm] = useState(() => initialValues(transaction));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const compatibleCategories = useMemo(
    () => categories.filter((category) => category.kind === form.type || category.kind === 'both'),
    [categories, form.type],
  );

  useEffect(() => {
    if (!compatibleCategories.some((category) => category.id === form.categoryId)) {
      setForm((current) => ({ ...current, categoryId: '' }));
    }
  }, [compatibleCategories, form.categoryId]);

  const update = (key: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  function validate(): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    if (!form.type) next.type = ['Choose a transaction type.'];
    if (!form.accountId) next.accountId = ['Choose an account.'];
    if (!form.categoryId) next.categoryId = ['Choose a category.'];
    if (toMinorUnits(form.amount) === undefined)
      next.amountMinor = ['Enter a positive EUR amount with at most two decimal places.'];
    if (!toIsoDate(form.transactionDate))
      next.transactionDate = ['Enter a real date as DD.MM.YYYY.'];
    if (!toIsoDate(form.entryDate)) next.entryDate = ['Enter a real date as DD.MM.YYYY.'];
    return next;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    setMessage('');
    if (Object.keys(validationErrors).length) {
      setMessage('Bitte korrigieren Sie die markierten Felder.');
      return;
    }
    setBusy(true);
    const result = await saveTransaction(
      {
        type: form.type,
        accountId: form.accountId,
        categoryId: form.categoryId,
        amountMinor: toMinorUnits(form.amount)!,
        transactionDate: toIsoDate(form.transactionDate)!,
        entryDate: toIsoDate(form.entryDate)!,
        payee: form.payee,
        notes: form.notes,
      },
      transaction?.id,
    );
    setBusy(false);
    if (!result.success) {
      setErrors(result.fieldErrors ?? {});
      setMessage(result.message ?? 'Bitte korrigieren Sie die markierten Felder.');
      return;
    }
    setMessage(
      transaction ? 'Transaktion wurde aktualisiert.' : 'Transaktion wurde erstellt.',
    );
    onSuccess?.();
  }

  const fieldError = (field: string) => errors[field]?.[0];
  const describedBy = (field: string) =>
    fieldError(field) ? `transaction-${field}-error` : undefined;

  return (
    <section aria-labelledby="transaction-form-heading" className="account-panel transaction-form">
      <h2 id="transaction-form-heading">{transaction ? 'Transaktion bearbeiten' : 'Neue Transaktion'}</h2>
      <form noValidate onSubmit={submit}>
        <div className="transaction-form-grid">
          <fieldset className="transaction-type-field">
            <legend>Typ <span aria-hidden="true">*</span></legend>
            <div className="transaction-type-switch">
              <label><input checked={form.type === 'expense'} name="transaction-type" onChange={() => update('type', 'expense')} type="radio" value="expense" />Ausgabe</label>
              <label><input checked={form.type === 'income'} name="transaction-type" onChange={() => update('type', 'income')} type="radio" value="income" />Einnahme</label>
            </div>
            {fieldError('type') && (
              <span className="field-error" id="transaction-type-error">
                {fieldError('type')}
              </span>
            )}
          </fieldset>
          <label htmlFor="transaction-account">
            Konto <span aria-hidden="true">*</span>
            <select
              id="transaction-account"
              aria-describedby={describedBy('accountId')}
              aria-invalid={Boolean(fieldError('accountId'))}
              required
              value={form.accountId}
              onChange={(event) => update('accountId', event.target.value)}
            >
              <option value="">Konto wählen</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            {fieldError('accountId') && (
              <span className="field-error" id="transaction-accountId-error">
                {fieldError('accountId')}
              </span>
            )}
          </label>
          <label htmlFor="transaction-category">
            Kategorie <span aria-hidden="true">*</span>
            <select
              id="transaction-category"
              aria-describedby={describedBy('categoryId')}
              aria-invalid={Boolean(fieldError('categoryId'))}
              required
              value={form.categoryId}
              onChange={(event) => update('categoryId', event.target.value)}
            >
              <option value="">Kategorie wählen</option>
              {compatibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {fieldError('categoryId') && (
              <span className="field-error" id="transaction-categoryId-error">
                {fieldError('categoryId')}
              </span>
            )}
          </label>
          <label htmlFor="transaction-amount">
            Betrag (EUR) <span aria-hidden="true">*</span>
            <input
              id="transaction-amount"
              aria-describedby={describedBy('amountMinor')}
              aria-invalid={Boolean(fieldError('amountMinor'))}
              inputMode="decimal"
              required
              value={form.amount}
              onChange={(event) => update('amount', event.target.value)}
            />
            {fieldError('amountMinor') && (
              <span className="field-error" id="transaction-amountMinor-error">
                {fieldError('amountMinor')}
              </span>
            )}
          </label>
          <label htmlFor="transaction-date">
            Transaktionsdatum (DD.MM.YYYY) <span aria-hidden="true">*</span>
            <input
              id="transaction-date"
              aria-describedby={describedBy('transactionDate')}
              aria-invalid={Boolean(fieldError('transactionDate'))}
              inputMode="numeric"
              required
              value={form.transactionDate}
              onChange={(event) => update('transactionDate', event.target.value)}
            />
            {fieldError('transactionDate') && (
              <span className="field-error" id="transaction-transactionDate-error">
                {fieldError('transactionDate')}
              </span>
            )}
          </label>
          <label htmlFor="entry-date">
            Erfassungsdatum (DD.MM.YYYY) <span aria-hidden="true">*</span>
            <input
              id="entry-date"
              aria-describedby={describedBy('entryDate')}
              aria-invalid={Boolean(fieldError('entryDate'))}
              inputMode="numeric"
              required
              value={form.entryDate}
              onChange={(event) => update('entryDate', event.target.value)}
            />
            {fieldError('entryDate') && (
              <span className="field-error" id="transaction-entryDate-error">
                {fieldError('entryDate')}
              </span>
            )}
          </label>
          <label htmlFor="transaction-payee">
            Händler / Zahlungsempfänger (optional)
            <input
              id="transaction-payee"
              value={form.payee}
              onChange={(event) => update('payee', event.target.value)}
            />
          </label>
          <label htmlFor="transaction-notes">
            Notiz (optional)
            <textarea
              id="transaction-notes"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
            />
          </label>
        </div>
        {message && (
          <p
            aria-live="polite"
            className="account-feedback"
            role={Object.keys(errors).length ? 'alert' : 'status'}
          >
            {message}
          </p>
        )}
        <div className="account-form-actions">
          <button disabled={busy} type="submit">
            {transaction ? 'Änderungen speichern' : 'Transaktion speichern'}
          </button>
        </div>
      </form>
    </section>
  );
}
