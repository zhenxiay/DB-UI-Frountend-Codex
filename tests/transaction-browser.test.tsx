import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransactionBrowser } from '../src/components/transaction-browser';
import { deleteTransaction, saveTransaction } from '../src/server/transactions/actions';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/transactions',
  useRouter: () => ({ push, refresh }),
}));
vi.mock('../src/server/transactions/actions', () => ({
  deleteTransaction: vi.fn(),
  saveTransaction: vi.fn(),
}));

const accounts = [{ id: 'account-1', name: 'Main account' }];
const categories = [
  { id: 'expense-groceries', name: 'Groceries', kind: 'expense' },
  { id: 'income-salary', name: 'Salary', kind: 'income' },
];
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
const defaultQuery = {
  search: undefined,
  sortBy: 'transactionDate' as const,
  sortDirection: 'desc' as const,
};

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
    vi.mocked(deleteTransaction).mockReset().mockResolvedValue({ success: true });
    vi.mocked(saveTransaction).mockReset().mockResolvedValue({ success: true });
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
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeVisible();
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
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers creation on populated and filtered lists, and resets dismissed create and edit forms', () => {
    const view = renderBrowser({ query: { ...defaultQuery, search: 'other' }, transactions: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(screen.getByRole('heading', { name: 'Add transaction' })).toBeVisible();
    const category = screen.getByLabelText('Category *');
    expect(within(category).getByRole('option', { name: 'Groceries' })).toBeInTheDocument();
    expect(within(category).queryByRole('option', { name: 'Salary' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Payee (optional)'), {
      target: { value: 'Discard me' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel adding transaction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(screen.getByLabelText('Payee (optional)')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'income' } });
    expect(
      within(screen.getByLabelText('Category *')).getByRole('option', { name: 'Salary' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Category *')).queryByRole('option', { name: 'Groceries' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel adding transaction' }));

    view.unmount();
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getAllByLabelText('Payee (optional)')[0], {
      target: { value: 'Unsaved edit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing transaction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Payee (optional)')).toHaveValue('Corner shop');
  });

  it('creates once, keeps the filtered and sorted URL, and announces success even when excluded', async () => {
    renderBrowser({
      query: { ...defaultQuery, search: 'other', sortBy: 'amountMinor', sortDirection: 'asc' },
      transactions: [],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    fireEvent.change(screen.getByLabelText('Account *'), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText('Category *'), {
      target: { value: 'expense-groceries' },
    });
    fireEvent.change(screen.getByLabelText('Amount (EUR) *'), { target: { value: '12,34' } });
    fireEvent.change(screen.getByLabelText('Transaction date (DD.MM.YYYY) *'), {
      target: { value: '29.09.2026' },
    });
    fireEvent.change(screen.getByLabelText('Entry date (DD.MM.YYYY) *'), {
      target: { value: '29.09.2026' },
    });
    fireEvent.change(screen.getByLabelText('Payee (optional)'), {
      target: { value: 'Corner shop' },
    });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Food' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create transaction' }));
    await waitFor(() => expect(saveTransaction).toHaveBeenCalledTimes(1));
    expect(saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        accountId: 'account-1',
        categoryId: 'expense-groceries',
        amountMinor: 1234,
        transactionDate: '2026-09-29',
        entryDate: '2026-09-29',
        payee: 'Corner shop',
        notes: 'Food',
      }),
      undefined,
    );
    expect(await screen.findByText('Transaction created successfully.')).toBeVisible();
    expect(screen.getByText('No transactions match the current filters.')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Add transaction' })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('requires an account before creation and links to Accounts', () => {
    renderBrowser({ accounts: [], transactions: [] });
    expect(screen.getByText(/Create an account before adding a transaction/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to Accounts' })).toHaveAttribute(
      'href',
      '/accounts',
    );
    expect(screen.queryByRole('button', { name: 'Add transaction' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create transaction' })).not.toBeInTheDocument();
  });

  it('keeps the create form and input on a failed save', async () => {
    vi.mocked(saveTransaction).mockResolvedValue({ success: false, message: 'Account not found.' });
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    fireEvent.change(screen.getByLabelText('Account *'), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText('Category *'), {
      target: { value: 'expense-groceries' },
    });
    fireEvent.change(screen.getByLabelText('Amount (EUR) *'), { target: { value: '12,34' } });
    fireEvent.change(screen.getByLabelText('Payee (optional)'), {
      target: { value: 'Corner shop' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create transaction' }));
    expect(await screen.findByText('Account not found.')).toBeVisible();
    expect(screen.getByLabelText('Payee (optional)')).toHaveValue('Corner shop');
    expect(screen.getByRole('heading', { name: 'Add transaction' })).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('opens an accessible confirmation and cancels without deleting the transaction', () => {
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit transaction' })).toBeVisible();

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    const dialog = screen.getByRole('dialog', { name: 'Delete transaction?' });
    expect(dialog).toHaveTextContent('Main account, 29.09.2026');
    expect(dialog).toHaveTextContent(/−12,34.*€.*Corner shop/);
    expect(dialog).toHaveTextContent('This action cannot be undone.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(document.querySelector('.transaction-browser > div')).toHaveAttribute('inert');

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const confirmButton = screen.getByRole('button', { name: 'Confirm deletion' });
    fireEvent.keyDown(cancelButton, { key: 'Tab' });
    expect(confirmButton).toHaveFocus();
    fireEvent.keyDown(confirmButton, { key: 'Tab', shiftKey: true });
    expect(cancelButton).toHaveFocus();
    fireEvent.click(cancelButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
    expect(deleteTransaction).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('waits for one delete request, announces success, and refreshes the current list', async () => {
    let finishDelete: (result: Awaited<ReturnType<typeof deleteTransaction>>) => void = () =>
      undefined;
    vi.mocked(deleteTransaction).mockReturnValue(
      new Promise((resolve) => {
        finishDelete = resolve;
      }),
    );
    renderBrowser({
      query: {
        ...defaultQuery,
        search: 'shop',
        accountId: 'account-1',
        sortBy: 'amountMinor',
        sortDirection: 'asc',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirmButton = screen.getByRole('button', { name: 'Confirm deletion' });
    fireEvent.click(confirmButton);

    expect(deleteTransaction).toHaveBeenCalledTimes(1);
    expect(deleteTransaction).toHaveBeenCalledWith('transaction-1');
    expect(confirmButton).toBeDisabled();
    expect(
      screen.queryByRole('status', { name: 'Transaction deletion result' }),
    ).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      finishDelete({ success: true });
      await Promise.resolve();
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
    const successMessage = screen.getByRole('status', { name: 'Transaction deletion result' });
    expect(successMessage).toHaveTextContent(
      'Deleted transaction: Main account, 29.09.2026, −12,34',
    );
    expect(successMessage).toHaveTextContent('Corner shop');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(successMessage).toHaveFocus();
  });

  it('keeps a failed delete open with an error and allows a retry', async () => {
    vi.mocked(deleteTransaction)
      .mockResolvedValueOnce({ success: false, message: 'Database unavailable.' })
      .mockResolvedValueOnce({ success: true });
    renderBrowser();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Transaction was not deleted. Database unavailable. You can retry or cancel.',
    );
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('Corner shop')).toBeVisible();
    expect(
      screen.queryByRole('status', { name: 'Transaction deletion result' }),
    ).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
