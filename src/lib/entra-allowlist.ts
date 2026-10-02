export type AuthenticatedIdentity = {
  email?: string | null;
  id?: string | null;
};

function normalizeIdentity(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/** Matches the configured Entra identity by email or stable provider subject. */
export function isAllowedIdentity(
  identity: AuthenticatedIdentity | null | undefined,
  allowedIdentity: string,
): boolean {
  const expected = normalizeIdentity(allowedIdentity);
  if (!expected || !identity || typeof identity.id !== 'string' || !identity.id.trim()) {
    return false;
  }

  return [identity.email, identity.id]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => normalizeIdentity(value) === expected);
}
