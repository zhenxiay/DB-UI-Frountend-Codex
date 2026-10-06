import Link from 'next/link';

import type { DashboardData } from '../server/dashboard/query';
import { DashboardMonthSelector } from './dashboard-month-selector';
import { DashboardSpendingChart } from './dashboard-spending-chart';

type DashboardOverviewProps = Readonly<{ dashboard: DashboardData }>;

const integerFormatter = new Intl.NumberFormat('de-DE', { useGrouping: true });

function euro(minor: number, explicitPositive = false): string {
  const absolute = BigInt(minor < 0 ? -minor : minor);
  const euros = integerFormatter.format(absolute / BigInt(100));
  const cents = String(absolute % BigInt(100)).padStart(2, '0');
  return `${minor < 0 ? '−' : explicitPositive ? '+' : ''}${euros},${cents} €`;
}

function displayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

function displayMonth(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}

export function DashboardOverview({ dashboard }: DashboardOverviewProps) {
  const month = displayMonth(dashboard.month);
  const cards = [
    { label: 'Gesamtsaldo', value: dashboard.totalBalanceMinor, context: `Über ${dashboard.accounts.length} Konten`, className: 'dashboard-summary-total' },
    { label: `Einnahmen · ${month}`, value: dashboard.incomeMinor, context: 'Im gewählten Monat', className: 'positive-money', positive: true },
    { label: `Ausgaben · ${month}`, value: -dashboard.expensesMinor, context: 'Im gewählten Monat', className: 'negative-money' },
    { label: 'Verfügbar diesen Monat', value: dashboard.netMinor, context: 'Einnahmen abzüglich Ausgaben', className: '' },
  ];

  return (
    <div className="dashboard-overview">
      <section aria-label="Finanzübersicht" className="dashboard-summary">
        {cards.map((card) => (
          <article aria-label={card.label} className={`dashboard-summary-card ${card.className}`} key={card.label}>
            <h2>{card.label}</h2>
            <p className="dashboard-money">{euro(card.value, card.positive)}</p>
            <p className="dashboard-card-context">{card.context}</p>
          </article>
        ))}
      </section>

      <div className="dashboard-details">
        <div className="dashboard-chart-column">
          <DashboardSpendingChart month={month} spending={dashboard.categorySpending} selector={<DashboardMonthSelector month={dashboard.month} />} />
        </div>
        <section aria-labelledby="dashboard-accounts-heading" className="dashboard-panel dashboard-accounts">
          <div className="dashboard-panel-header"><h2 id="dashboard-accounts-heading">Konten</h2><Link href="/accounts">Alle anzeigen</Link></div>
          {dashboard.accounts.length === 0 ? (
            <p className="dashboard-empty">Noch keine Konten. <Link href="/accounts">Konto anlegen</Link></p>
          ) : (
            <ul className="dashboard-list">
              {dashboard.accounts.map((account) => (
                <li className="dashboard-list-item" key={account.id}>
                  <span aria-hidden="true" className="account-icon">▣</span>
                  <div className="dashboard-account-name"><h3>{account.name}</h3><p>{account.typeLabel}</p></div>
                  <p className={`dashboard-list-money ${account.currentBalanceMinor < 0 ? 'negative-money' : ''}`}>{euro(account.currentBalanceMinor)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="dashboard-recent-heading" className="dashboard-panel dashboard-recent">
        <div className="dashboard-panel-header"><h2 id="dashboard-recent-heading">Letzte Transaktionen</h2><Link href="/transactions">Alle Transaktionen</Link></div>
        {dashboard.recentTransactions.length === 0 ? (
          <p className="dashboard-empty">Noch keine Transaktionen vorhanden.</p>
        ) : (
          <div className="dashboard-table-scroll"><table className="dashboard-recent-table">
            <thead><tr><th scope="col">Transaktion</th><th scope="col">Konto</th><th scope="col">Kategorie</th><th scope="col">Datum</th><th scope="col">Betrag</th></tr></thead>
            <tbody>{dashboard.recentTransactions.map((transaction) => {
              const signedAmount = transaction.type === 'expense' ? -transaction.amountMinor : transaction.amountMinor;
              return <tr key={transaction.id}>
                <td><strong>{transaction.payee || 'Ohne Zahlungsempfänger'}</strong></td>
                <td>{transaction.accountName}</td>
                <td><span className="category-badge">{transaction.categoryName}</span></td>
                <td><time dateTime={transaction.transactionDate}>{displayDate(transaction.transactionDate)}</time></td>
                <td className={signedAmount < 0 ? 'negative-money' : 'positive-money'}>{euro(signedAmount, signedAmount > 0)}</td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
