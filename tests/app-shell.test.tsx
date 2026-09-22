import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../src/components/app-shell';

const pathname = vi.hoisted(() => ({ value: '/dashboard' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}));

describe('application shell', () => {
  beforeEach(() => {
    pathname.value = '/dashboard';
  });

  it('renders navigation, session identity, and sign out control', () => {
    render(<AppShell user={{ name: 'Alex Example', email: 'alex@example.test' }}>{null}</AppShell>);

    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('Alex Example')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
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
});
