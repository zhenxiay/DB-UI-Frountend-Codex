import { describe, expect, it } from 'vitest';

import { readAuthEnvironment } from '../src/lib/auth-environment';

const validEnvironment = {
  AUTH_SECRET: 'a-very-long-local-auth-secret-value',
  ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
  ENTRA_CLIENT_ID: '22222222-2222-4222-8222-222222222222',
  ENTRA_CLIENT_SECRET: 'local-client-secret',
  ENTRA_ALLOWED_USER: 'allowed@example.com',
};

describe('readAuthEnvironment', () => {
  it('returns validated Microsoft Entra and Auth.js configuration', () => {
    expect(readAuthEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it('rejects missing or malformed authentication configuration', () => {
    expect(() => readAuthEnvironment({ ...validEnvironment, AUTH_SECRET: 'short' })).toThrow();
    expect(() => readAuthEnvironment({ ...validEnvironment, ENTRA_TENANT_ID: 'tenant' })).toThrow();
    expect(() =>
      readAuthEnvironment({ ...validEnvironment, ENTRA_ALLOWED_OBJECT_ID: 'not-a-uuid' }),
    ).toThrow();
    expect(() =>
      readAuthEnvironment({ ...validEnvironment, ENTRA_ALLOWED_USER: undefined }),
    ).toThrow();
  });

  it('accepts a validated Object ID without an email allowlist', () => {
    const objectIdEnvironment = {
      ...validEnvironment,
      ENTRA_ALLOWED_USER: undefined,
      ENTRA_ALLOWED_OBJECT_ID: '33333333-3333-4333-8333-333333333333',
    };
    expect(readAuthEnvironment(objectIdEnvironment).ENTRA_ALLOWED_OBJECT_ID).toBe(
      objectIdEnvironment.ENTRA_ALLOWED_OBJECT_ID,
    );
  });
});
