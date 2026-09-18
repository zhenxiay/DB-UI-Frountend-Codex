export const protectedRoutePrefixes = ['/dashboard', '/accounts', '/transactions'] as const;

export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Returns the local sign-in URL when a mocked or real session is absent. */
export function signInRedirectFor(requestUrl: URL, authenticated: boolean): URL | null {
  if (authenticated || !isProtectedRoute(requestUrl.pathname)) {
    return null;
  }

  const signInUrl = new URL('/sign-in', requestUrl.origin);
  signInUrl.searchParams.set('callbackUrl', requestUrl.href);
  return signInUrl;
}
