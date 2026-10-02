import NextAuth, { type NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { z } from 'zod';

import { readAuthEnvironment } from './lib/auth-environment';
import { isAllowedIdentity } from './lib/entra-allowlist';
import { entraUserFromOidcClaims } from './lib/entra-oidc-profile';

const stableSubjectSchema = z.string().trim().min(1);

function entraIdentityFromCallback(
  account: { provider: string; providerAccountId: string; type: string } | null,
  profile: unknown,
) {
  if (account?.provider !== 'microsoft-entra-id' || account.type !== 'oidc') return null;

  const accountSubject = stableSubjectSchema.safeParse(account.providerAccountId);
  if (!accountSubject.success) return null;

  try {
    const identity = entraUserFromOidcClaims(profile);
    return identity.id === accountSubject.data ? identity : null;
  } catch {
    return null;
  }
}

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
    callbacks: {
      signIn({ account, profile }) {
        const identity = entraIdentityFromCallback(account, profile);
        return isAllowedIdentity(identity, environment.ENTRA_ALLOWED_USER);
      },
      jwt({ token, user, account, profile }) {
        if (user) {
          const identity = entraIdentityFromCallback(account, profile);
          if (!identity) return null;
          token.sub = identity.id;
          token.entraSubject = identity.id;
          token.email = identity.email;
        }
        return token;
      },
      session({ session, token }) {
        const subject = stableSubjectSchema.safeParse(token.sub);
        const persistedSubject = stableSubjectSchema.safeParse(token.entraSubject);
        return {
          ...session,
          user: {
            ...session.user,
            id:
              subject.success && persistedSubject.success && subject.data === persistedSubject.data
                ? subject.data
                : undefined,
          },
        };
      },
    },
  };
}

// Auth.js invokes this initializer for an incoming auth request. Keeping the
// call inside the callback prevents local credentials being read during build.
export const { auth, handlers, signIn, signOut } = NextAuth(() => createAuthConfig());
