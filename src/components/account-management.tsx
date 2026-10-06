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
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const accountNameRef = useRef<HTMLInputElement>(null);
  const deleteWasOpenRef = useRef(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const focusMessageAfterDeleteRef = useRef(false);
  const router = useRouter();

  useEffect(() => setAccountList(initialAccounts), [initialAccounts]);

  useEffect(() => {
    if (pendingDelete) {
      deleteWasOpenRef.current = true;
      cancelDeleteRef.current?.focus();
    } else if (deleteWasOpenRef.current) {
      if (focusMessageAfterDeleteRef.current) messageRef.current?.focus();
      else deleteButtonRef.current?.focus();
      deleteWasOpenRef.current = false;
      focusMessageAfterDeleteRef.current = false;
    }
  }, [pendingDelete]);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      setPendingDelete(undefined);
    }
    if (event.key !== 'Tab') return;
    const controls = deleteDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    if (!controls?.length) return;
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls[controls.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
      event.preventDefault();
      controls[0].focus();
    }
  }

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
      setMessage(result.message ?? 'Bitte korrigieren Sie die markierten Felder.');
      return;
    }

    setMessage(editingId ? 'Konto wurde aktualisiert.' : 'Konto wurde angelegt.');
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
      setMessage(result.message ?? 'Konto konnte nicht gelöscht werden.');
      focusMessageAfterDeleteRef.current = true;
      return;
    }

    setAccountList((current) => current.filter((account) => account.id !== deleted.id));
    setMessage(`Konto „${deleted.name}“ wurde gelöscht.`);
    focusMessageAfterDeleteRef.current = true;
  }

  return (
    <div className="account-management">
      <div className="route-intro"><p>Verwalten Sie Ihre Konten und Anfangssalden.</p><button className="primary-button" onClick={() => accountNameRef.current?.focus()} type="button">+ Konto anlegen</button></div>
      <section aria-labelledby="account-form-heading" className="account-panel">
        <h2 id="account-form-heading">{editingId ? 'Konto bearbeiten' : 'Konto anlegen'}</h2>
        <form onSubmit={submit} noValidate>
          <div className="account-form-grid">
            <label htmlFor="account-name">
              Kontoname
              <input
                ref={accountNameRef}
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
              Kontotyp
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
              Anfangssaldo (EUR)
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
              {editingId ? 'Änderungen speichern' : 'Konto anlegen'}
            </button>
            {editingId && (
              <button disabled={busy} onClick={reset} type="button">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </section>

      {message && (
        <p aria-live="polite" className="account-feedback" ref={messageRef} role="status" tabIndex={-1}>
          {message}
        </p>
      )}

      <section aria-labelledby="account-list-heading">
        <h2 id="account-list-heading">Ihre Konten</h2>
        {accountList.length === 0 ? (
          <p>Noch keine Konten vorhanden. Legen Sie oben Ihr erstes Konto an.</p>
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
                    <dt>Anfangssaldo</dt>
                    <dd>{money(account.openingBalanceMinor)}</dd>
                  </div>
                  <div>
                    <dt>Aktueller Saldo</dt>
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
                    Bearbeiten
                  </button>
                  <button
                    className="danger-button"
                    onClick={(event) => {
                      deleteButtonRef.current = event.currentTarget;
                      setPendingDelete(account);
                    }}
                    type="button"
                  >
                    Löschen
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
          onKeyDown={handleDialogKeyDown}
          role="dialog"
        >
          <div className="confirmation-dialog" ref={deleteDialogRef}>
            <h2 id="delete-account-title">Konto löschen?</h2>
            <p>„{pendingDelete.name}“ und alle zugehörigen Transaktionen löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="account-form-actions">
              <button className="danger-button" disabled={busy} onClick={confirmDelete} type="button">
                Löschen bestätigen
              </button>
              <button disabled={busy} onClick={() => setPendingDelete(undefined)} ref={cancelDeleteRef} type="button">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
