'use client';

import type { ReactNode } from 'react';
import type { User } from 'next-auth';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { SignOutButton } from './sign-out-button';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: '◈' },
  { href: '/transactions', label: 'Transaktionen', icon: '↕' },
  { href: '/accounts', label: 'Konten', icon: '▣' },
] as const;

type AppShellProps = Readonly<{ children: ReactNode; user: User }>;

function userIdentifier(user: User): string {
  return user.name?.trim() || user.email?.trim() || 'Angemeldetes Konto';
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = navigation.find(({ href }) => href === pathname)?.label ?? 'Dashboard';
  const today = new Intl.DateTimeFormat('de-DE', { dateStyle: 'full' }).format(new Date());
  const identity = userIdentifier(user);

  function openTransaction() {
    if (pathname === '/transactions') {
      window.dispatchEvent(new Event('saldo:create-transaction'));
    } else {
      router.push('/transactions?create=1');
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-brand" href="/dashboard">
          <span aria-hidden="true" className="app-brand-mark">S</span>
          saldo
        </Link>
        <p className="app-nav-label">Übersicht</p>
        <nav aria-label="Hauptnavigation" className="app-navigation">
          {navigation.map(({ href, label, icon }) => (
            <Link
              aria-current={pathname === href ? 'page' : undefined}
              className="app-navigation-link"
              href={href}
              key={href}
            >
              <span aria-hidden="true" className="app-nav-icon">{icon}</span>{label}
            </Link>
          ))}
        </nav>
        <div className="app-user-area">
          <p>Lokale Datenbank<br />Finanzdaten nur auf diesem Gerät</p>
          <div className="app-user-row">
            <span aria-hidden="true" className="app-avatar">{identity.slice(0, 2).toLocaleUpperCase('de-DE')}</span>
            <span aria-label="Angemeldetes Konto" className="app-user-identity" title={identity}>{identity}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="app-content">
        <div className="app-topbar">
          <div><p className="app-eyebrow">{today}</p><h1>{pageTitle}</h1></div>
          <button className="primary-button" onClick={openTransaction} type="button">+ Transaktion erfassen</button>
        </div>
        {children}
      </main>
    </div>
  );
}
