import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '@auth/core';
import { encode } from '@auth/core/jwt';

const allowedUser = vi.hoisted(() => ({ value: 'allowed@example.test' }));
const authMock = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({
  default: () => ({
    auth: authMock,
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../src/lib/auth-environment', () => ({
  readAuthEnvironment: () => ({
    AUTH_SECRET: 'a-very-long-local-auth-secret-value',
    ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
    ENTRA_CLIENT_ID: '22222222-2222-4222-8222-222222222222',
    ENTRA_CLIENT_SECRET: 'local-client-secret',
    ENTRA_ALLOWED_USER: allowedUser.value,
  }),
}));

import { createAuthConfig } from '../src/auth';
import { entraUserFromOidcClaims } from '../src/lib/entra-oidc-profile';
import { requireAllowedUser } from '../src/server/auth/authorization';
import { recordAuditEvent, type AuditDatabase } from '../src/server/audit/service';

beforeEach(() => {
  allowedUser.value = 'allowed@example.test';
  authMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function oidcProvider() {
  const provider = createAuthConfig().providers[0];
  if (typeof provider === 'string' || typeof provider === 'function' || provider.type !== 'oidc') {
    throw new Error('Expected OIDC provider');
  }
  return provider;
}

function oauthCallbackIdentity(claims: unknown) {
  const mappedUser = entraUserFromOidcClaims(claims);
  return {
    user: { ...mappedUser, id: 'generated-authjs-user-uuid' },
    account: {
      provider: 'microsoft-entra-id',
      type: 'oidc',
      providerAccountId: mappedUser.id,
    },
    profile: claims,
  };
}

async function signInWithClaims(claims: unknown) {
  const callbackIdentity = oauthCallbackIdentity(claims);
  const signIn = createAuthConfig().callbacks?.signIn;
  if (!signIn) throw new Error('Expected sign-in callback');
  return signIn(callbackIdentity as Parameters<typeof signIn>[0]);
}

describe('Microsoft Entra OIDC sign-in', () => {
  it('requests identity scopes without a Microsoft Graph permission', () => {
    const provider = oidcProvider();

    expect(provider).toMatchObject({
      id: 'microsoft-entra-id',
      type: 'oidc',
      options: { authorization: { params: { scope: 'openid profile email' } } },
    });
    const scope = provider.options?.authorization?.params?.scope;
    expect(scope?.split(' ')).toEqual(['openid', 'profile', 'email']);
  });

  it('uses validated OIDC claims and never fetches a Graph profile photo', async () => {
    const graphFetch = vi.fn(() => {
      throw new Error('Microsoft Graph must not be called');
    });
    vi.stubGlobal('fetch', graphFetch);
    const provider = oidcProvider();
    if (!provider.options?.profile) {
      throw new Error('Expected OIDC profile mapper');
    }

    const user = await provider.options.profile(
      {
        sub: 'stable-entra-subject',
        name: 'Allowed User',
        email: 'allowed@example.test',
      } as Parameters<typeof provider.options.profile>[0],
      { access_token: 'unused' } as Parameters<typeof provider.options.profile>[1],
    );

    expect(user).toEqual({
      id: 'stable-entra-subject',
      name: 'Allowed User',
      email: 'allowed@example.test',
      image: null,
    });
    expect(graphFetch).not.toHaveBeenCalled();
  });

  it('rejects missing or invalid stable subjects before sign-in', () => {
    expect(() => entraUserFromOidcClaims({ email: 'allowed@example.test' })).toThrow();
    expect(() => entraUserFromOidcClaims({ sub: ' ', email: 'allowed@example.test' })).toThrow();
    expect(() =>
      entraUserFromOidcClaims({ sub: 'stable-subject', email: 'not-an-email' }),
    ).toThrow();
  });

  it('accepts a matching email claim with whitespace and different letter case', async () => {
    expect(
      await signInWithClaims({ sub: 'stable-entra-subject', email: '  ALLOWED@Example.Test  ' }),
    ).toBe(true);
  });

  it('uses a valid preferred_username when the email claim is absent', async () => {
    const claims = {
      sub: 'stable-entra-subject',
      preferred_username: '  ALLOWED@Example.Test  ',
    };

    expect(entraUserFromOidcClaims(claims)).toMatchObject({
      id: 'stable-entra-subject',
      email: 'ALLOWED@Example.Test',
    });
    expect(await signInWithClaims(claims)).toBe(true);
  });

  it('does not use preferred_username to override a nonmatching email claim', async () => {
    expect(
      await signInWithClaims({
        sub: 'stable-entra-subject',
        email: 'other@example.test',
        preferred_username: 'allowed@example.test',
      }),
    ).toBe(false);
  });

  it('rejects a subject equal to the allowed email when the email claim differs', async () => {
    expect(
      await signInWithClaims({
        sub: 'allowed@example.test',
        email: 'other@example.test',
      }),
    ).toBe(false);
    expect(await signInWithClaims({ sub: 'allowed@example.test' })).toBe(false);
  });

  it('denies absent or mismatched preferred_username when email is absent', async () => {
    expect(await signInWithClaims({ sub: 'stable-entra-subject' })).toBe(false);
    expect(
      await signInWithClaims({
        sub: 'stable-entra-subject',
        preferred_username: 'other@example.test',
      }),
    ).toBe(false);
    expect(
      await signInWithClaims({ sub: 'stable-entra-subject', preferred_username: 'not-an-email' }),
    ).toBe(false);
  });

  it('requires sub even when preferred_username matches the email allowlist', () => {
    expect(() => entraUserFromOidcClaims({ preferred_username: 'allowed@example.test' })).toThrow();
    expect(() =>
      entraUserFromOidcClaims({ sub: ' ', preferred_username: 'allowed@example.test' }),
    ).toThrow();
  });

  it('continues to allow a configured stable subject without an email claim', async () => {
    allowedUser.value = 'stable-entra-subject';
    expect(await signInWithClaims({ sub: 'stable-entra-subject' })).toBe(true);
    expect(
      await signInWithClaims({ sub: 'stable-entra-subject', preferred_username: 'not-an-email' }),
    ).toBe(true);
  });

  it('ignores preferred_username when a valid email claim is present', async () => {
    expect(
      await signInWithClaims({
        sub: 'stable-entra-subject',
        email: 'allowed@example.test',
        preferred_username: 'not-an-email',
      }),
    ).toBe(true);
  });

  it('allows the configured identity and rejects missing or different identities', async () => {
    const signIn = createAuthConfig().callbacks?.signIn;
    if (!signIn) throw new Error('Expected sign-in callback');
    const allowed = oauthCallbackIdentity({
      sub: 'stable-entra-subject',
      email: 'allowed@example.test',
    });

    expect(await signIn(allowed as Parameters<typeof signIn>[0])).toBe(true);
    expect(
      await signIn({
        ...allowed,
        account: { ...allowed.account, providerAccountId: 'other' },
      } as Parameters<typeof signIn>[0]),
    ).toBe(false);
    expect(await signIn({ ...allowed, account: null } as Parameters<typeof signIn>[0])).toBe(false);
    expect(await signIn({ ...allowed, profile: {} } as Parameters<typeof signIn>[0])).toBe(false);
  });

  it('carries the provider subject, not Auth.js user UUID, through session, authorization, and audit', async () => {
    const config = createAuthConfig();
    const jwt = config.callbacks?.jwt;
    const signIn = config.callbacks?.signIn;
    if (!jwt || !signIn) throw new Error('Expected auth callbacks');
    const callbackIdentity = oauthCallbackIdentity({
      sub: 'stable-entra-subject',
      preferred_username: 'allowed@example.test',
    });
    expect(await signIn(callbackIdentity as Parameters<typeof signIn>[0])).toBe(true);
    const token = await jwt({
      token: { name: callbackIdentity.user.name, email: callbackIdentity.user.email },
      ...callbackIdentity,
    } as Parameters<typeof jwt>[0]);
    if (!token) throw new Error('Expected JWT');
    expect(token.sub).toBe('stable-entra-subject');
    expect(token.sub).not.toBe(callbackIdentity.user.id);
    const sessionToken = await encode({
      token,
      secret: 'a-very-long-local-auth-secret-value',
      salt: 'authjs.session-token',
    });
    const response = await Auth(
      new Request('http://localhost:3000/api/auth/session', {
        headers: { cookie: `authjs.session-token=${sessionToken}` },
      }),
      { ...config, basePath: '/api/auth' },
    );
    const session = await response.json();

    expect(response.status).toBe(200);
    expect(session.user).toMatchObject({
      id: 'stable-entra-subject',
      email: 'allowed@example.test',
    });
    authMock.mockResolvedValue(session);
    const actor = await requireAllowedUser();
    expect(actor.id).toBe('stable-entra-subject');
    const values = vi.fn(() => ({ returning: () => ({ get: () => ({}) }) }));
    const database = { insert: () => ({ values }) } as unknown as AuditDatabase;
    recordAuditEvent(database, actor, {
      action: 'create',
      entityType: 'account',
      entityId: 'fixture-account',
      afterSnapshot: { name: 'Fixture' },
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ actorIdentity: 'stable-entra-subject' }),
    );
  });
});
