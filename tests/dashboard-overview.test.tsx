import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '../src/app/(protected)/dashboard/page';
import { DashboardOverview } from '../src/components/dashboard-overview';
import type { DashboardData } from '../src/server/dashboard/query';

const getDashboardForUser = vi.hoisted(() => vi.fn());

vi.mock('../src/server/dashboard/query', () => ({ getDashboardForUser }));

const emptyDashboard: DashboardData = {
  month: '2026-03',
  accounts: [],
  totalBalanceMinor: 0,
  recentTransactions: [],
  incomeMinor: 0,
  expensesMinor: 0,
  netMinor: 0,
  categorySpending: [],
};

const dashboard: DashboardData = {
  ...emptyDashboard,
  accounts: [
    {
      id: 'checking',
      name: 'Daily account',
      typeLabel: 'Checking',
      openingBalanceMinor: 0,
      currentBalanceMinor: -125,
    },
    {
      id: 'savings',
      name: 'Rainy day',
      typeLabel: 'Savings',
      openingBalanceMinor: 25050,
      currentBalanceMinor: 25050,
    },
  ],
  totalBalanceMinor: 24925,
  incomeMinor: 120000,
  expensesMinor: 127525,
  netMinor: -7525,
  recentTransactions: [
    {
      id: 'outside',
      transactionDate: '2026-04-01',
      entryDate: '2026-04-01',
      type: 'expense',
      amountMinor: 125,
      payee: null,
      accountId: 'checking',
      accountName: 'Daily account',
      categoryId: 'groceries',
      categoryName: 'Groceries',
    },
    {
      id: 'salary',
      transactionDate: '2026-03-20',
      entryDate: '2026-03-21',
      type: 'income',
      amountMinor: 120000,
      payee: 'Employer',
      accountId: 'savings',
      accountName: 'Rainy day',
      categoryId: 'salary',
      categoryName: 'Salary',
    },
  ],
};

function card(label: string) {
  return screen.getByRole('article', { name: label });
}

describe('dashboard overview', () => {
  beforeEach(() => getDashboardForUser.mockReset());

  it('renders the authorized read model with four exact card values and account balances', async () => {
    getDashboardForUser.mockResolvedValue(dashboard);
    render(await DashboardPage());

    expect(getDashboardForUser).toHaveBeenCalledOnce();
    expect(getDashboardForUser).toHaveBeenCalledWith();
    expect(screen.getAllByText('March 2026')).toHaveLength(3);
    expect(card('Total current balance')).toHaveTextContent('249,25 €');
    expect(card('Selected-month income')).toHaveTextContent('1.200,00 €');
    expect(card('Selected-month expenses')).toHaveTextContent('1.275,25 €');
    expect(card('Available amount')).toHaveTextContent('−75,25 €');
    expect(card('Available amount')).toHaveTextContent('income minus expenses');

    const accounts = within(screen.getByRole('region', { name: 'Account balances' }));
    const rows = accounts.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Daily account');
    expect(rows[0]).toHaveTextContent('Checking');
    expect(rows[0]).toHaveTextContent('−1,25 €');
    expect(rows[1]).toHaveTextContent('Rainy day');
    expect(rows[1]).toHaveTextContent('Savings');
    expect(rows[1]).toHaveTextContent('250,50 €');
  });

  it('keeps the supplied recent order across months and shows dates, identities, and signed amounts', () => {
    render(<DashboardOverview dashboard={dashboard} />);

    const recent = within(screen.getByRole('region', { name: 'Recent transactions' }));
    const rows = recent.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('No payee recorded');
    expect(rows[0]).toHaveTextContent('01.04.2026');
    expect(rows[0]).toHaveTextContent('Daily account');
    expect(rows[0]).toHaveTextContent('Groceries');
    expect(rows[0]).toHaveTextContent('−1,25 €');
    expect(within(rows[0]).getByText('01.04.2026')).toHaveAttribute('dateTime', '2026-04-01');
    expect(rows[1]).toHaveTextContent('Employer');
    expect(rows[1]).toHaveTextContent('20.03.2026');
    expect(rows[1]).toHaveTextContent('Rainy day');
    expect(rows[1]).toHaveTextContent('Salary');
    expect(rows[1]).toHaveTextContent('1.200,00 €');
  });

  it('shows separate helpful empty states and zero cards with no data', () => {
    render(<DashboardOverview dashboard={emptyDashboard} />);

    for (const label of [
      'Total current balance',
      'Selected-month income',
      'Selected-month expenses',
      'Available amount',
    ]) {
      expect(card(label)).toHaveTextContent('0,00 €');
    }
    expect(
      screen.getByText('No accounts yet. Add an account to see your balances here.'),
    ).toBeVisible();
    expect(
      screen.getByText('No transactions yet. Your latest income and expenses will appear here.'),
    ).toBeVisible();
  });

  it('keeps account balances with no transactions and shows recent items when selected-month activity is zero', () => {
    const accountsOnly = {
      ...emptyDashboard,
      accounts: dashboard.accounts,
      totalBalanceMinor: dashboard.totalBalanceMinor,
    };
    const { rerender } = render(<DashboardOverview dashboard={accountsOnly} />);
    expect(screen.getByText('Daily account')).toBeVisible();
    expect(
      screen.getByText('No transactions yet. Your latest income and expenses will appear here.'),
    ).toBeVisible();

    rerender(
      <DashboardOverview
        dashboard={{ ...accountsOnly, recentTransactions: [dashboard.recentTransactions[0]] }}
      />,
    );
    expect(card('Selected-month income')).toHaveTextContent('0,00 €');
    expect(card('Selected-month expenses')).toHaveTextContent('0,00 €');
    expect(card('Available amount')).toHaveTextContent('0,00 €');
    expect(screen.getByText('No payee recorded')).toBeVisible();
    expect(
      screen.queryByText('No transactions yet. Your latest income and expenses will appear here.'),
    ).not.toBeInTheDocument();
  });

});
