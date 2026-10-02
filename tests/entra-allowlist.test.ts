import { describe, expect, it } from 'vitest';

import { isAllowedEntraIdentity, isAllowedIdentity } from '../src/lib/entra-allowlist';

const objectIdConfig = {
  ENTRA_ALLOWED_USER: 'allowed@example.test',
  ENTRA_ALLOWED_OBJECT_ID: '33333333-3333-4333-8333-333333333333',
  ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
};
const objectIdIdentity = {
  id: 'stable-oidc-subject',
  email: 'different@example.test',
  oid: objectIdConfig.ENTRA_ALLOWED_OBJECT_ID,
  tid: objectIdConfig.ENTRA_TENANT_ID,
};

describe('Entra single-user allowlist', () => {
  it('allows the configured email identity case-insensitively', () => {
    expect(
      isAllowedIdentity(
        { id: 'stable-subject', email: 'Allowed@Example.com' },
        ' allowed@example.com ',
      ),
    ).toBe(true);
  });

  it('allows a configured stable provider subject', () => {
    expect(isAllowedIdentity({ id: 'entra-subject-123' }, 'entra-subject-123')).toBe(true);
  });

  it('does not let a subject bypass an email-configured allowlist', () => {
    expect(
      isAllowedIdentity(
        { id: 'allowed@example.com', email: 'other@example.com' },
        'allowed@example.com',
      ),
    ).toBe(false);
    expect(isAllowedIdentity({ id: 'allowed@example.com' }, 'allowed@example.com')).toBe(false);
  });

  it.each([
    [undefined, 'allowed@example.com'],
    [{ email: null }, 'allowed@example.com'],
    [{ email: 'other@example.com' }, 'allowed@example.com'],
    [{ email: 'allowed@example.com' }, 'allowed@example.com'],
    [{ id: ' ', email: 'allowed@example.com' }, 'allowed@example.com'],
  ])('rejects missing or non-allowed identity %j', (identity, allowed) => {
    expect(isAllowedIdentity(identity, allowed)).toBe(false);
  });

  it('uses Object ID and tenant before email or subject configuration', () => {
    expect(isAllowedEntraIdentity(objectIdIdentity, objectIdConfig)).toBe(true);
    expect(
      isAllowedEntraIdentity(
        {
          ...objectIdIdentity,
          oid: '44444444-4444-4444-8444-444444444444',
          email: 'allowed@example.test',
        },
        objectIdConfig,
      ),
    ).toBe(false);
  });

  it.each([
    { ...objectIdIdentity, oid: undefined },
    { ...objectIdIdentity, oid: 'malformed' },
    { ...objectIdIdentity, tid: undefined },
    { ...objectIdIdentity, tid: 'malformed' },
    { ...objectIdIdentity, tid: '55555555-5555-4555-8555-555555555555' },
    { ...objectIdIdentity, id: ' ' },
  ])('denies missing or mismatched Object ID, tenant, or subject: %j', (identity) => {
    expect(isAllowedEntraIdentity(identity, objectIdConfig)).toBe(false);
  });

  it('keeps email and subject modes when Object ID is absent', () => {
    expect(
      isAllowedEntraIdentity(
        { id: 'stable-subject', email: 'allowed@example.test' },
        { ENTRA_ALLOWED_USER: 'allowed@example.test' },
      ),
    ).toBe(true);
    expect(
      isAllowedEntraIdentity({ id: 'stable-subject' }, { ENTRA_ALLOWED_USER: 'stable-subject' }),
    ).toBe(true);
  });
});
