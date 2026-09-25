'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { AccountListItem } from '../server/accounts/query';
import { removeAccount, saveAccount } from '../server/accounts/actions';

type Props = Readonly<{ initialAccounts: AccountListItem[] }>;
type FormValues = { name: string; typeLabel: string; openingBalance: string };

const emptyForm: FormValues = { name: '', typeLabel: '', openingBalance: '0.00' };
const money = (minor: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(minor / 100);

function toMinorUnits(value: string) {
  const amount = Number(value.trim().replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

export function AccountManagement({ initialAccounts }: Props) {
  const [accountList, setAccountList] = useState(initialAccounts);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AccountListItem>();
  const [busy, setBusy] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => setAccountList(initialAccounts), [initialAccounts]);

  useEffect(() => {
    if (!pendingDelete) {
      deleteButtonRef.current?.focus();
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => previouslyFocused?.focus();
  }, [pendingDelete]);

  const update = (key: keyof FormValues, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const reset = () => {
    setEditingId(undefined);
    setForm(emptyForm);
    setErrors({});
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    const result = await saveAccount(
      {
        name: form.name,
        typeLabel: form.typeLabel,
        openingBalanceMinor: toMinorUnits(form.openingBalance),
      },
      editingId,
    );

    setBusy(false);
    if (!result.success) {
      setErrors(result.fieldErrors ?? {});
      setMessage(result.message ?? 'Please correct the highlighted fields.');
      return;
    }

    setMessage(editingId ? 'Account updated successfully.' : 'Account created successfully.');
    reset();
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    const deleted = pendingDelete;
    setBusy(true);
    const result = await removeAccount(deleted.id);
    setBusy(false);
    setPendingDelete(undefined);

    if (!result.success) {
      setMessage(result.message ?? 'Account could not be deleted.');
      return;
    }

    setAccountList((current) => current.filter((account) => account.id !== deleted.id));
    setMessage(`Account “${deleted.name}” deleted successfully.`);
  }

  return (
    <div className="account-management">
      <section aria-labelledby="account-form-heading" className="account-panel">
        <h2 id="account-form-heading">{editingId ? 'Edit account' : 'Add account'}</h2>
        <form onSubmit={submit} noValidate>
          <div className="account-form-grid">
            <label htmlFor="account-name">
              Account name
              <input
                aria-describedby={errors.name ? 'account-name-error' : undefined}
                aria-invalid={Boolean(errors.name)}
                id="account-name"
                required
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
              />
              {errors.name?.map((error) => (
                <span className="field-error" id="account-name-error" key={error}>
                  {error}
                </span>
              ))}
            </label>
            <label htmlFor="account-type">
              Account type
              <input
                aria-describedby={errors.typeLabel ? 'account-type-error' : undefined}
                aria-invalid={Boolean(errors.typeLabel)}
                id="account-type"
                required
                value={form.typeLabel}
                onChange={(event) => update('typeLabel', event.target.value)}
              />
              {errors.typeLabel?.map((error) => (
                <span className="field-error" id="account-type-error" key={error}>
                  {error}
                </span>
              ))}
            </label>
            <label htmlFor="opening-balance">
              Opening balance (EUR)
              <input
                aria-describedby={errors.openingBalanceMinor ? 'opening-balance-error' : undefined}
                aria-invalid={Boolean(errors.openingBalanceMinor)}
                id="opening-balance"
                inputMode="decimal"
                required
                value={form.openingBalance}
                onChange={(event) => update('openingBalance', event.target.value)}
              />
              {errors.openingBalanceMinor?.map((error) => (
                <span className="field-error" id="opening-balance-error" key={error}>
                  {error}
                </span>
              ))}
            </label>
          </div>
          <div className="account-form-actions">
            <button disabled={busy} type="submit">
              {editingId ? 'Save changes' : 'Create account'}
            </button>
            {editingId && (
              <button disabled={busy} onClick={reset} type="button">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {message && (
        <p aria-live="polite" className="account-feedback" role="status">
          {message}
        </p>
      )}

      <section aria-labelledby="account-list-heading">
        <h2 id="account-list-heading">Your accounts</h2>
        {accountList.length === 0 ? (
          <p>No accounts yet. Add your first account above.</p>
        ) : (
          <div className="account-list">
            {accountList.map((account) => (
              <article className="account-card" key={account.id}>
                <div>
                  <h3>{account.name}</h3>
                  <p>{account.typeLabel}</p>
                </div>
                <dl>
                  <div>
                    <dt>Opening balance</dt>
                    <dd>{money(account.openingBalanceMinor)}</dd>
                  </div>
                  <div>
                    <dt>Current balance</dt>
                    <dd className={account.currentBalanceMinor < 0 ? 'negative-money' : undefined}>
                      {money(account.currentBalanceMinor)}
                    </dd>
                  </div>
                </dl>
                <div className="account-card-actions">
                  <button
                    onClick={() => {
                      setEditingId(account.id);
                      setForm({
                        name: account.name,
                        typeLabel: account.typeLabel,
                        openingBalance: (account.openingBalanceMinor / 100).toFixed(2),
                      });
                      setErrors({});
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="danger-button"
                    onClick={(event) => {
                      deleteButtonRef.current = event.currentTarget;
                      setPendingDelete(account);
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {pendingDelete && (
        <div
          aria-labelledby="delete-account-title"
          aria-modal="true"
          className="confirmation-backdrop"
          role="dialog"
        >
          <div className="confirmation-dialog">
            <h2 id="delete-account-title">Delete account?</h2>
            <p>Delete “{pendingDelete.name}” and its transactions? This cannot be undone.</p>
            <div className="account-form-actions">
              <button autoFocus disabled={busy} onClick={confirmDelete} type="button">
                Confirm deletion
              </button>
              <button disabled={busy} onClick={() => setPendingDelete(undefined)} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
