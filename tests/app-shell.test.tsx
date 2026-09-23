import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../src/components/app-shell';
import ProtectedLayout from '../src/app/(protected)/layout';

const pathname = vi.hoisted(() => ({ value: '/dashboard' }));
const signOut = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => vi.fn());
const readAuthEnvironment = vi.hoisted(() => vi.fn());
const isAllowedIdentity = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect,
  usePathname: () => pathname.value,
}));

vi.mock('next-auth/react', () => ({ signOut }));

vi.mock('../src/auth', () => ({ auth }));

vi.mock('../src/lib/auth-environment', () => ({ readAuthEnvironment }));

vi.mock('../src/lib/entra-allowlist', () => ({ isAllowedIdentity }));

describe('application shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname.value = '/dashboard';
    readAuthEnvironment.mockReturnValue({ ENTRA_ALLOWED_USER: 'alex@example.test' });
    isAllowedIdentity.mockReturnValue(true);
  });

  it('renders navigation, session identity, and sign out control', () => {
    render(<AppShell user={{ name: 'Alex Example', email: 'alex@example.test' }}>{null}</AppShell>);

    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('Alex Example')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  it('ends the Auth.js session and returns to sign-in when Sign out is activated', () => {
    render(<AppShell user={{ email: 'alex@example.test' }}>{null}</AppShell>);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/sign-in' });
  });

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/transactions', 'Transactions'],
    ['/accounts', 'Accounts'],
  ])('exposes %s through a keyboard-focusable native link', (href, label) => {
    render(<AppShell user={{ email: 'alex@example.test' }}>{null}</AppShell>);

    const link = screen.getByRole('link', { name: label });
    link.focus();

    expect(link).toHaveFocus();
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveProperty('tabIndex', 0);
  });

  it.each(['/dashboard', '/transactions', '/accounts'])(
    'marks only the current route active on %s',
    (currentPath) => {
      pathname.value = currentPath;
      render(<AppShell user={{ email: 'alex@example.test' }}>{null}</AppShell>);

      expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
      expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute('href', currentPath);
    },
  );

  it('redirects an unauthenticated request before it can return shell content', async () => {
    const redirectError = new Error('redirected');
    auth.mockResolvedValue(null);
    redirect.mockImplementation(() => {
      throw redirectError;
    });

    await expect(ProtectedLayout({ children: <p>Private finance content</p> })).rejects.toThrow(
      redirectError,
    );

    expect(redirect).toHaveBeenCalledWith('/sign-in?error=AccessDenied');
    expect(isAllowedIdentity).not.toHaveBeenCalled();
    expect(screen.queryByText('Private finance content')).not.toBeInTheDocument();
  });

  it('redirects a non-allowlisted session before it can return shell content', async () => {
    const redirectError = new Error('redirected');
    auth.mockResolvedValue({ user: { email: 'other@example.test' } });
    isAllowedIdentity.mockReturnValue(false);
    redirect.mockImplementation(() => {
      throw redirectError;
    });

    await expect(ProtectedLayout({ children: <p>Private finance content</p> })).rejects.toThrow(
      redirectError,
    );

    expect(isAllowedIdentity).toHaveBeenCalledWith(
      { email: 'other@example.test' },
      'alex@example.test',
    );
    expect(redirect).toHaveBeenCalledWith('/sign-in?error=AccessDenied');
    expect(screen.queryByText('Private finance content')).not.toBeInTheDocument();
  });

  it('keeps all desktop header controls available at a laptop viewport width', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    render(<AppShell user={{ email: 'alex.long-address@example.test' }}>{null}</AppShell>);

    expect(window.innerWidth).toBe(1024);
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
});
