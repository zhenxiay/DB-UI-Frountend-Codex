import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const allowedObjectId = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('next-auth', () => ({
  default: () => ({ auth: vi.fn(), handlers: {}, signIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock('../src/lib/auth-environment', () => ({
  readAuthEnvironment: () => ({
    AUTH_SECRET: 'private-local-auth-secret-value-123456',
    ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
    ENTRA_CLIENT_ID: '22222222-2222-4222-8222-222222222222',
    ENTRA_CLIENT_SECRET: 'private-client-secret',
    ENTRA_ALLOWED_USER: 'allowed@example.test',
    ENTRA_ALLOWED_OBJECT_ID: allowedObjectId.value,
  }),
}));

import { createAuthConfig } from '../src/auth';

const privateProfile = {
  sub: 'private-stable-subject',
  email: 'private@example.test',
  name: 'Private Name',
};

const callbackIdentity = {
  user: { id: 'private-generated-user-id', email: privateProfile.email },
  account: {
    provider: 'microsoft-entra-id',
    type: 'oidc',
    providerAccountId: privateProfile.sub,
    access_token: 'private-access-token',
  },
  profile: privateProfile,
};

beforeEach(() => {
  allowedObjectId.value = undefined;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expectPrivateValuesAbsent() {
  const output = JSON.stringify(vi.mocked(console.warn).mock.calls);
  for (const value of [
    privateProfile.sub,
    privateProfile.email,
    privateProfile.name,
    callbackIdentity.user.id,
    callbackIdentity.account.access_token,
    'private-client-secret',
    'allowed@example.test',
    '33333333-3333-4333-8333-333333333333',
  ]) {
    expect(output).not.toContain(value);
  }
}

async function deniedSignIn(input: unknown) {
  const signIn = createAuthConfig().callbacks?.signIn;
  if (!signIn) throw new Error('Expected sign-in callback');
  return signIn(input as Parameters<typeof signIn>[0]);
}

describe('local Entra denial diagnostics', () => {
  it('reports a missing subject during provider profile mapping without claim values', () => {
    const provider = createAuthConfig().providers[0];
    if (
      typeof provider === 'string' ||
      typeof provider === 'function' ||
      !('options' in provider)
    ) {
      throw new Error('Expected Entra provider');
    }
    const mapProfile = provider.options?.profile;
    if (!mapProfile) throw new Error('Expected profile mapper');

    expect(() => mapProfile({ ...privateProfile, sub: ' ' } as never, {} as never)).toThrow(
      'Entra identity claims are invalid.',
    );
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith('AUTH_DENIED:ENTRA_SUBJECT_MISSING');
    expectPrivateValuesAbsent();
  });

  it('reports invalid profile claims without including the rejected value', () => {
    const provider = createAuthConfig().providers[0];
    if (
      typeof provider === 'string' ||
      typeof provider === 'function' ||
      !('options' in provider)
    ) {
      throw new Error('Expected Entra provider');
    }
    const mapProfile = provider.options?.profile;
    if (!mapProfile) throw new Error('Expected profile mapper');

    expect(() =>
      mapProfile({ ...privateProfile, email: 'private-invalid-email' } as never, {} as never),
    ).toThrow('Entra identity claims are invalid.');
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith('AUTH_DENIED:ENTRA_CLAIMS_INVALID');
    expectPrivateValuesAbsent();
  });

  it.each([
    [
      'ENTRA_CALLBACK_UNSUPPORTED',
      { ...callbackIdentity, account: { ...callbackIdentity.account, provider: 'other' } },
    ],
    [
      'ENTRA_SUBJECT_MISSING',
      { ...callbackIdentity, account: { ...callbackIdentity.account, providerAccountId: ' ' } },
    ],
    [
      'ENTRA_SUBJECT_MISMATCH',
      {
        ...callbackIdentity,
        account: { ...callbackIdentity.account, providerAccountId: 'another-private-subject' },
      },
    ],
    ['ENTRA_CLAIMS_INVALID', { ...callbackIdentity, profile: { ...privateProfile, email: 'bad' } }],
    ['ENTRA_ALLOWLIST_MISMATCH', callbackIdentity],
  ])('reports %s without private callback data', async (code, input) => {
    expect(await deniedSignIn(input)).toBe(false);
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(`AUTH_DENIED:${code}`);
    expectPrivateValuesAbsent();
  });

  it('keeps Object ID mismatch details out of diagnostics', async () => {
    allowedObjectId.value = '33333333-3333-4333-8333-333333333333';
    expect(
      await deniedSignIn({
        ...callbackIdentity,
        profile: {
          ...privateProfile,
          oid: '44444444-4444-4444-8444-444444444444',
          tid: '11111111-1111-4111-8111-111111111111',
        },
      }),
    ).toBe(false);
    expect(console.warn).toHaveBeenCalledWith('AUTH_DENIED:ENTRA_ALLOWLIST_MISMATCH');
    expectPrivateValuesAbsent();
    const output = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(output).not.toContain('44444444-4444-4444-8444-444444444444');
  });
});
