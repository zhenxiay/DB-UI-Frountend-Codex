import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { auth } from '../../auth';
import { AppShell } from '../../components/app-shell';
import { readAuthEnvironment } from '../../lib/auth-environment';
import { isAllowedEntraIdentity } from '../../lib/entra-allowlist';

type ProtectedLayoutProps = Readonly<{ children: ReactNode }>;

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const session = await auth();
  const environment = readAuthEnvironment();
  const user = session?.user;

  if (!user || !isAllowedEntraIdentity(user, environment)) {
    redirect('/sign-in?error=AccessDenied');
  }

  return <AppShell user={user}>{children}</AppShell>;
}
