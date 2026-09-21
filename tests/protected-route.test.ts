import { describe, expect, it } from 'vitest';

import { isProtectedRoute, safeCallbackPath, signInRedirectFor } from '../src/lib/protected-routes';

describe('protected finance routes', () => {
  it.each(['/dashboard', '/dashboard/monthly', '/accounts', '/accounts/new', '/transactions/1'])(
    'recognizes %s and nested paths as protected',
    (pathname) => {
      expect(isProtectedRoute(pathname)).toBe(true);
    },
  );

  it('redirects a mocked unauthenticated session to sign-in without contacting Microsoft', () => {
    const redirect = signInRedirectFor(new URL('/accounts/new', 'http://localhost:3000'), false);

    expect(redirect?.href).toBe(
      'http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Faccounts%2Fnew',
    );
  });

  it('permits a mocked authenticated session', () => {
    expect(signInRedirectFor(new URL('/transactions', 'http://localhost:3000'), true)).toBeNull();
  });

  it('does not preserve a protocol-relative callback URL', async () => {
    expect(safeCallbackPath('//external.example')).toBe('/dashboard');
    expect(safeCallbackPath('/accounts')).toBe('/accounts');
  });
});
