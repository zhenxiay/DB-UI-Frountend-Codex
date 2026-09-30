import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransactionBrowser } from '../src/components/transaction-browser';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/transactions',
  useRouter: () => ({ push, refresh }),
}));
vi.mock('../src/server/transactions/actions', () => ({ saveTransaction: vi.fn() }));

const accounts = [{ id: 'account-1', name: 'Main account' }];
const categories = [{ id: 'expense-groceries', name: 'Groceries', kind: 'expense' }];
const transaction = {
  id: 'transaction-1',
  accountId: 'account-1',
  accountName: 'Main account',
  categoryId: 'expense-groceries',
  categoryName: 'Groceries',
  type: 'expense',
  amountMinor: 1234,
  transactionDate: '2026-09-29',
  entryDate: '2026-09-29',
  payee: 'Corner shop',
  notes: 'Food',
};
const defaultQuery = { sortBy: 'transactionDate' as const, sortDirection: 'desc' as const };

function renderBrowser(overrides: Partial<React.ComponentProps<typeof TransactionBrowser>> = {}) {
  return render(
    <TransactionBrowser
      accounts={accounts}
      categories={categories}
      query={defaultQuery}
      transactions={[transaction]}
      {...overrides}
    />,
  );
}

describe('transaction browser', () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it('renders the newest-first transaction table with German dates and signed EUR amounts', () => {
    renderBrowser();

    expect(screen.getByRole('columnheader', { name: 'Date' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByText('29.09.2026')).toBeVisible();
    expect(screen.getByText(/−12,34.*€/)).toBeVisible();
    expect(screen.getByText('No filters are active.')).toBeVisible();
  });

  it('applies and clears filters through the supported URL query options', () => {
    renderBrowser();
    fireEvent.change(screen.getByLabelText('Search payee or note'), { target: { value: 'shop' } });
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'account-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(push).toHaveBeenCalledWith('/transactions?search=shop&accountId=account-1');

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(push).toHaveBeenLastCalledWith('/transactions');
  });

  it('changes sort using an allowlisted sort parameter', () => {
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Amount' }));
    expect(push).toHaveBeenCalledWith('/transactions?sortBy=amountMinor&sortDirection=asc');
  });

  it('explains an empty result without presenting it as an error', () => {
    renderBrowser({ transactions: [] });
    expect(screen.getByText('No transactions match the current filters.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens edit and deletion flows without deleting a transaction', () => {
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit transaction' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/Delete flow opened for “Corner shop”/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirm deletion' })).not.toBeInTheDocument();
  });
});
