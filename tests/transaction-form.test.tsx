import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransactionForm } from '../src/components/transaction-form';

const saveTransaction = vi.hoisted(() => vi.fn());
vi.mock('../src/server/transactions/actions', () => ({ saveTransaction }));

const accounts = [{ id: 'account-1', name: 'Main account' }];
const categories = [
  { id: 'income-salary', name: 'Salary', kind: 'income' },
  { id: 'expense-groceries', name: 'Groceries', kind: 'expense' },
  { id: 'both-other', name: 'Other', kind: 'both' },
];

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'account-1' } });
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'expense-groceries' } });
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '12,34' } });
  fireEvent.change(screen.getByLabelText(/transaction date/i), { target: { value: '29.09.2026' } });
  fireEvent.change(screen.getByLabelText(/entry date/i), { target: { value: '29.09.2026' } });
}

describe('transaction form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveTransaction.mockResolvedValue({ success: true });
  });

  it('submits create values as minor units and ISO dates', async () => {
    render(<TransactionForm accounts={accounts} categories={categories} />);
    fillRequired();
    fireEvent.submit(screen.getByRole('button', { name: 'Create transaction' }).closest('form')!);

    await waitFor(() =>
      expect(saveTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amountMinor: 1234,
          transactionDate: '2026-09-29',
          entryDate: '2026-09-29',
        }),
        undefined,
      ),
    );
  });

  it('prefills edit values and submits the transaction id', async () => {
    render(
      <TransactionForm
        accounts={accounts}
        categories={categories}
        transaction={{
          id: 'transaction-1',
          accountId: 'account-1',
          categoryId: 'income-salary',
          type: 'income',
          amountMinor: 2500,
          transactionDate: '2026-01-02',
          entryDate: '2026-01-03',
          payee: 'Employer',
          notes: 'Monthly',
        }}
      />,
    );
    expect(screen.getByLabelText(/amount/i)).toHaveValue('25.00');
    expect(screen.getByLabelText(/transaction date/i)).toHaveValue('02.01.2026');
    expect(screen.getByLabelText(/payee/i)).toHaveValue('Employer');
    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
    await waitFor(() =>
      expect(saveTransaction).toHaveBeenCalledWith(expect.anything(), 'transaction-1'),
    );
  });

  it('validates required amount and dates before submitting', async () => {
    render(<TransactionForm accounts={accounts} categories={categories} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Create transaction' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please correct the highlighted fields.',
    );
    expect(saveTransaction).not.toHaveBeenCalled();
  });

  it('shows only compatible categories and retains values on server errors', async () => {
    saveTransaction.mockResolvedValue({ success: false, message: 'Account not found.' });
    render(<TransactionForm accounts={accounts} categories={categories} />);
    expect(screen.getByRole('option', { name: 'Groceries' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Salary' })).not.toBeInTheDocument();
    fillRequired();
    fireEvent.change(screen.getByLabelText(/payee/i), { target: { value: 'Shop' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create transaction' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Account not found.');
    expect(screen.getByLabelText(/payee/i)).toHaveValue('Shop');
    expect(
      screen.queryByLabelText(/transfer|split|receipt|recurring|planned|custom category/i),
    ).not.toBeInTheDocument();
  });
});
