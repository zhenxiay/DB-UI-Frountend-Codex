import NextAuth, { type NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

import { readAuthEnvironment } from './lib/auth-environment';
import { entraUserFromOidcClaims } from './lib/entra-oidc-profile';

export function createAuthConfig(): NextAuthConfig {
  const environment = readAuthEnvironment();

  return {
    providers: [
      MicrosoftEntraID({
        clientId: environment.ENTRA_CLIENT_ID,
        clientSecret: environment.ENTRA_CLIENT_SECRET,
        issuer: `https://login.microsoftonline.com/${environment.ENTRA_TENANT_ID}/v2.0`,
        authorization: { params: { scope: 'openid profile email' } },
        profile: entraUserFromOidcClaims,
      }),
    ],
    pages: {
      signIn: '/sign-in',
    },
    session: {
      strategy: 'jwt',
    },
    secret: environment.AUTH_SECRET,
    trustHost: true,
  };
}

// Auth.js invokes this initializer for an incoming auth request. Keeping the
// call inside the callback prevents local credentials being read during build.
export const { auth, handlers, signIn, signOut } = NextAuth(() => createAuthConfig());
