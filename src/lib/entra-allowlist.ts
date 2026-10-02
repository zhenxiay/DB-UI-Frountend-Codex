import { z } from 'zod';

export type AuthenticatedIdentity = {
  email?: string | null;
  id?: string | null;
};

function normalizeIdentity(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/** Match the configured email or stable subject, requiring a subject either way. */
export function isAllowedIdentity(
  identity: AuthenticatedIdentity | null | undefined,
  allowedIdentity: string,
): boolean {
  const expected = normalizeIdentity(allowedIdentity);
  if (!expected || !identity || typeof identity.id !== 'string' || !identity.id.trim()) {
    return false;
  }

  const emailAllowlist = z.email().safeParse(expected).success;
  const candidate = emailAllowlist ? identity.email : identity.id;
  return typeof candidate === 'string' && normalizeIdentity(candidate) === expected;
}
