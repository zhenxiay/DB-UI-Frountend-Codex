import type { DashboardData } from '../server/dashboard/query';
import { DashboardMonthSelector } from './dashboard-month-selector';
import { DashboardSpendingChart } from './dashboard-spending-chart';

type DashboardOverviewProps = Readonly<{ dashboard: DashboardData }>;

const integerFormatter = new Intl.NumberFormat('de-DE', { useGrouping: true });

function euro(minor: number): string {
  const absolute = BigInt(minor < 0 ? -minor : minor);
  const euros = integerFormatter.format(absolute / BigInt(100));
  const cents = String(absolute % BigInt(100)).padStart(2, '0');
  return `${minor < 0 ? '−' : ''}${euros},${cents} €`;
}

function displayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

function displayMonth(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}

export function DashboardOverview({ dashboard }: DashboardOverviewProps) {
  const month = displayMonth(dashboard.month);
  const cards = [
    { label: 'Total current balance', value: dashboard.totalBalanceMinor, context: 'All accounts' },
    { label: 'Selected-month income', value: dashboard.incomeMinor, context: month },
    { label: 'Selected-month expenses', value: -dashboard.expensesMinor, context: month },
    {
      label: 'Available amount',
      value: dashboard.netMinor,
      context: `${month} · income minus expenses`,
    },
  ];

  return (
    <div className="dashboard-overview">
      <header className="dashboard-intro">
        <h1>Dashboard</h1>
        <p>
          Overview for <strong>{month}</strong>
        </p>
        <DashboardMonthSelector month={dashboard.month} />
      </header>

      <section aria-label="Financial summary" className="dashboard-summary">
        {cards.map((card) => (
          <article aria-label={card.label} className="dashboard-summary-card" key={card.label}>
            <h2>{card.label}</h2>
            <p className={card.value < 0 ? 'dashboard-money negative-money' : 'dashboard-money'}>
              {euro(card.value)}
            </p>
            <p className="dashboard-card-context">{card.context}</p>
          </article>
        ))}
      </section>

      <DashboardSpendingChart month={month} spending={dashboard.categorySpending} />

      <div className="dashboard-details">
        <section aria-labelledby="dashboard-accounts-heading" className="dashboard-panel">
          <h2 id="dashboard-accounts-heading">Account balances</h2>
          {dashboard.accounts.length === 0 ? (
            <p>No accounts yet. Add an account to see your balances here.</p>
          ) : (
            <ul className="dashboard-list">
              {dashboard.accounts.map((account) => (
                <li className="dashboard-list-item" key={account.id}>
                  <div>
                    <h3>{account.name}</h3>
                    <p>{account.typeLabel}</p>
                  </div>
                  <p
                    className={
                      account.currentBalanceMinor < 0
                        ? 'dashboard-list-money negative-money'
                        : 'dashboard-list-money'
                    }
                  >
                    {euro(account.currentBalanceMinor)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dashboard-recent-heading" className="dashboard-panel">
          <h2 id="dashboard-recent-heading">Recent transactions</h2>
          {dashboard.recentTransactions.length === 0 ? (
            <p>No transactions yet. Your latest income and expenses will appear here.</p>
          ) : (
            <ol className="dashboard-list">
              {dashboard.recentTransactions.map((transaction) => {
                const signedAmount =
                  transaction.type === 'expense'
                    ? -transaction.amountMinor
                    : transaction.amountMinor;
                return (
                  <li className="dashboard-list-item" key={transaction.id}>
                    <div>
                      <h3>{transaction.payee || 'No payee recorded'}</h3>
                      <p>
                        <time dateTime={transaction.transactionDate}>
                          {displayDate(transaction.transactionDate)}
                        </time>
                        {' · '}
                        {transaction.accountName}
                        {' · '}
                        {transaction.categoryName}
                      </p>
                    </div>
                    <p
                      className={
                        signedAmount < 0
                          ? 'dashboard-list-money negative-money'
                          : 'dashboard-list-money'
                      }
                    >
                      {euro(signedAmount)}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
