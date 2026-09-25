import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountManagement } from '../src/components/account-management';

const saveAccount = vi.hoisted(() => vi.fn());
const removeAccount = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock('../src/server/accounts/actions', () => ({ removeAccount, saveAccount }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const accounts = [
  {
    id: 'account-1',
    name: 'Main account',
    typeLabel: 'Checking',
    openingBalanceMinor: 1_000_00,
    currentBalanceMinor: 950_00,
  },
];

describe('account management interface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveAccount.mockResolvedValue({ success: true });
    removeAccount.mockResolvedValue({ success: true });
  });

  it('creates an account and refreshes the server-rendered list', async () => {
    render(<AccountManagement initialAccounts={[]} />);

    fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Savings' } });
    fireEvent.change(screen.getByLabelText('Account type'), { target: { value: 'Savings' } });
    fireEvent.change(screen.getByLabelText('Opening balance (EUR)'), {
      target: { value: '12,34' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);

    await waitFor(() =>
      expect(saveAccount).toHaveBeenCalledWith(
        { name: 'Savings', typeLabel: 'Savings', openingBalanceMinor: 1234 },
        undefined,
      ),
    );
    expect(refresh).toHaveBeenCalledOnce();
    expect(await screen.findByRole('status')).toHaveTextContent('Account created successfully.');
  });

  it('shows field-level server validation errors without losing input', async () => {
    saveAccount.mockResolvedValue({
      success: false,
      message: 'Account validation failed.',
      fieldErrors: { name: ['Account name is required.'] },
    });
    render(<AccountManagement initialAccounts={[]} />);

    const name = screen.getByLabelText('Account name');
    fireEvent.change(name, { target: { value: 'Still entered' } });
    fireEvent.submit(name.closest('form')!);

    expect(await screen.findByText('Account name is required.')).toBeVisible();
    expect(name).toHaveValue('Still entered');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('edits an account and displays the calculated balances', async () => {
    render(<AccountManagement initialAccounts={accounts} />);

    expect(screen.getByText('1.000,00 €')).toBeVisible();
    expect(screen.getByText('950,00 €')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit account' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(saveAccount).toHaveBeenCalledWith(
        { name: 'Renamed', typeLabel: 'Checking', openingBalanceMinor: 100_000 },
        'account-1',
      ),
    );
  });

  it('requires confirmation before deletion and supports cancellation', async () => {
    render(<AccountManagement initialAccounts={accounts} />);

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “Main account”');
    expect(removeAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();

    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => expect(removeAccount).toHaveBeenCalledWith('account-1'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Account “Main account” deleted successfully.',
    );
    expect(screen.queryByRole('heading', { name: 'Main account' })).not.toBeInTheDocument();
  });
});
