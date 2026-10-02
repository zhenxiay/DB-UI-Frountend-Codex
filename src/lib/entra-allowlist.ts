import { z } from 'zod';

export type AuthenticatedIdentity = {
  email?: string | null;
  id?: string | null;
  oid?: string | null;
  tid?: string | null;
};

export type EntraAllowlistConfig = {
  ENTRA_ALLOWED_USER?: string;
  ENTRA_ALLOWED_OBJECT_ID?: string;
  ENTRA_TENANT_ID?: string;
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

/** Object-ID mode takes precedence and never falls back to email or subject. */
export function isAllowedEntraIdentity(
  identity: AuthenticatedIdentity | null | undefined,
  config: EntraAllowlistConfig,
): boolean {
  if (config.ENTRA_ALLOWED_OBJECT_ID) {
    const subject = z.string().trim().min(1).safeParse(identity?.id);
    const objectId = z.uuid().safeParse(identity?.oid);
    const tenantId = z.uuid().safeParse(identity?.tid);
    const configuredObjectId = z.uuid().safeParse(config.ENTRA_ALLOWED_OBJECT_ID);
    const configuredTenantId = z.uuid().safeParse(config.ENTRA_TENANT_ID);
    return (
      subject.success &&
      objectId.success &&
      tenantId.success &&
      configuredObjectId.success &&
      configuredTenantId.success &&
      objectId.data.toLowerCase() === configuredObjectId.data.toLowerCase() &&
      tenantId.data.toLowerCase() === configuredTenantId.data.toLowerCase()
    );
  }

  return isAllowedIdentity(identity, config.ENTRA_ALLOWED_USER ?? '');
}
