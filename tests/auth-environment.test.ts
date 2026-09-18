import { describe, expect, it } from 'vitest';

import { readAuthEnvironment } from '../src/lib/auth-environment';

const validEnvironment = {
  AUTH_SECRET: 'a-very-long-local-auth-secret-value',
  ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
  ENTRA_CLIENT_ID: '22222222-2222-4222-8222-222222222222',
  ENTRA_CLIENT_SECRET: 'local-client-secret',
};

describe('readAuthEnvironment', () => {
  it('returns validated Microsoft Entra and Auth.js configuration', () => {
    expect(readAuthEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it('rejects missing or malformed authentication configuration', () => {
    expect(() => readAuthEnvironment({ ...validEnvironment, AUTH_SECRET: 'short' })).toThrow();
    expect(() => readAuthEnvironment({ ...validEnvironment, ENTRA_TENANT_ID: 'tenant' })).toThrow();
  });
});
