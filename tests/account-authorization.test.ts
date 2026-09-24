import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());

vi.mock('../src/auth', () => ({ auth: authMock }));
vi.mock('../src/lib/auth-environment', () => ({
  readAuthEnvironment: () => ({ ENTRA_ALLOWED_USER: 'allowed@example.test' }),
}));

import { AccessDeniedError, requireAllowedUser } from '../src/server/auth/authorization';

describe('account mutation authorization', () => {
  beforeEach(() => authMock.mockReset());

  it('returns the authenticated allowlisted identity', async () => {
    const identity = { id: 'entra-subject', email: 'allowed@example.test' };
    authMock.mockResolvedValue({ user: identity });

    await expect(requireAllowedUser()).resolves.toEqual(identity);
  });

  it.each([undefined, null, { user: { email: 'rejected@example.test' } }])(
    'rejects a missing or rejected session: %j',
    async (session) => {
      authMock.mockResolvedValue(session);

      await expect(requireAllowedUser()).rejects.toBeInstanceOf(AccessDeniedError);
    },
  );
});
