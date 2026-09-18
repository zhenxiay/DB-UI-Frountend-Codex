import { NextResponse, type NextRequest } from 'next/server';

import { auth } from './auth';
import { signInRedirectFor } from './lib/protected-routes';

export default auth((request) => {
  const signInUrl = signInRedirectFor(request.nextUrl, Boolean(request.auth?.user));
  if (signInUrl) {
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/accounts/:path*', '/transactions/:path*'],
};
