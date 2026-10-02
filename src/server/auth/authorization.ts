import 'server-only';

import { auth } from '../../auth';
import { isAllowedEntraIdentity } from '../../lib/entra-allowlist';
import { readAuthEnvironment } from '../../lib/auth-environment';
import type { AuthenticatedIdentity } from '../../lib/entra-allowlist';

export class AccessDeniedError extends Error {
  constructor() {
    super('The signed-in identity is not allowed to use this application.');
    this.name = 'AccessDeniedError';
  }
}

/** Returns the current allowed session or fails closed for server mutations. */
export async function requireAllowedUser(): Promise<AuthenticatedIdentity> {
  const session = await auth();
  const environment = readAuthEnvironment();

  if (!session?.user) {
    throw new AccessDeniedError();
  }

  if (!isAllowedEntraIdentity(session.user, environment)) {
    throw new AccessDeniedError();
  }

  return session.user;
}
