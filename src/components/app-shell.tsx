'use client';

import type { ReactNode } from 'react';
import type { User } from 'next-auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SignOutButton } from './sign-out-button';

const navigation = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/accounts', label: 'Accounts' },
] as const;

type AppShellProps = Readonly<{ children: ReactNode; user: User }>;

function userIdentifier(user: User): string {
  return user.name?.trim() || user.email?.trim() || 'Signed-in user';
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="app-brand" href="/dashboard">
          Personal Finance
        </Link>
        <nav aria-label="Primary navigation" className="app-navigation">
          {navigation.map(({ href, label }) => (
            <Link
              aria-current={pathname === href ? 'page' : undefined}
              className="app-navigation-link"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="app-user-area">
          <span
            aria-label="Signed-in user"
            className="app-user-identity"
            style={{
              maxWidth: 'min(24rem, 25vw)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={userIdentifier(user)}
          >
            {userIdentifier(user)}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
