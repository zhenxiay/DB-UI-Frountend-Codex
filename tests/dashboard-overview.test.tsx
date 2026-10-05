import { fireEvent, render, screen, within } from '@testing-library/react';
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
    render(await DashboardPage({}));

    expect(getDashboardForUser).toHaveBeenCalledOnce();
    expect(getDashboardForUser).toHaveBeenCalledWith();
    expect(screen.getByLabelText('Spending month')).toHaveValue('2026-03');
    expect(screen.getByRole('img', { name: 'Spending by category for March 2026' })).toBeVisible();
    expect(card('Total current balance')).toHaveTextContent('249,25 €');
    expect(card('Selected-month income')).toHaveTextContent('1.200,00 €');
    expect(card('Selected-month expenses')).toHaveTextContent('−1.275,25 €');
    expect(within(card('Selected-month expenses')).getByText('−1.275,25 €')).toHaveClass(
      'negative-money',
    );
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
    expect(
      screen.getByRole('img', { name: 'Spending by category for March 2026' }),
    ).toHaveTextContent('No expenses for this month.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows each selected-month category amount in an accessible table alongside the chart', () => {
    render(
      <DashboardOverview
        dashboard={{
          ...dashboard,
          categorySpending: [
            { categoryId: 'expense-groceries', categoryName: 'Groceries', amountMinor: 12345 },
            { categoryId: 'expense-dining', categoryName: 'Dining out', amountMinor: 125 },
          ],
        }}
      />,
    );

    expect(screen.getByRole('img', { name: 'Spending by category for March 2026' })).toBeVisible();
    const table = screen.getByRole('table', { name: 'Category spending for March 2026' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('Groceries');
    expect(rows[1]).toHaveTextContent('123,45 €');
    expect(rows[2]).toHaveTextContent('Dining out');
    expect(rows[2]).toHaveTextContent('1,25 €');
  });

  it('submits the selected month and renders all monthly values from the refreshed dashboard result', async () => {
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(() => {});
    const april: DashboardData = {
      ...dashboard,
      month: '2026-04',
      incomeMinor: 50000,
      expensesMinor: 425,
      netMinor: 49575,
      categorySpending: [
        { categoryId: 'expense-groceries', categoryName: 'Groceries', amountMinor: 425 },
      ],
    };
    getDashboardForUser.mockResolvedValue(april);
    render(await DashboardPage({ searchParams: Promise.resolve({ month: '2026-04' }) }));

    expect(getDashboardForUser).toHaveBeenCalledWith('2026-04');
    expect(screen.getByLabelText('Spending month')).toHaveValue('2026-04');
    expect(card('Selected-month income')).toHaveTextContent('500,00 €');
    expect(card('Selected-month expenses')).toHaveTextContent('−4,25 €');
    expect(card('Available amount')).toHaveTextContent('495,75 €');
    expect(screen.getByRole('img', { name: 'Spending by category for April 2026' })).toBeVisible();
    expect(
      screen.getByRole('table', { name: 'Category spending for April 2026' }),
    ).toHaveTextContent('Groceries4,25 €');

    fireEvent.change(screen.getByLabelText('Spending month'), { target: { value: '2026-05' } });
    expect(submit).toHaveBeenCalledOnce();
    submit.mockRestore();
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
