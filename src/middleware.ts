import {
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
  type NextRequest,
} from 'next/server';

import { auth } from './auth';
import { readAuthEnvironment } from './lib/auth-environment';
import { isAllowedEntraIdentity } from './lib/entra-allowlist';
import { signInRedirectFor } from './lib/protected-routes';

const authenticatedMiddleware = auth((request) => {
  const user = request.auth?.user;
  const authenticated = Boolean(user);
  const signInUrl = signInRedirectFor(request.nextUrl, authenticated);
  if (signInUrl) {
    return NextResponse.redirect(signInUrl);
  }

  const environment = readAuthEnvironment();
  if (!isAllowedEntraIdentity(user, environment)) {
    const deniedUrl = new URL('/sign-in', request.nextUrl.origin);
    deniedUrl.searchParams.set('error', 'AccessDenied');
    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
});

// With a lazy Auth.js config, auth(callback) resolves to the middleware handler.
// Next.js requires this module itself to export a function synchronously.
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  // Auth.js types this lazy wrapper as a route handler, though it returns a
  // Next.js middleware handler when invoked with a middleware callback.
  const handler = (await authenticatedMiddleware) as unknown as NextMiddleware;
  return handler(request, event);
}

export const config = {
  matcher: ['/dashboard/:path*', '/accounts/:path*', '/transactions/:path*'],
};
