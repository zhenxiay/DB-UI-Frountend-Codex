import NextAuth, { type NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { z } from 'zod';

import { readAuthEnvironment } from './lib/auth-environment';
import { isAllowedEntraIdentity } from './lib/entra-allowlist';
import { entraUserFromOidcClaims } from './lib/entra-oidc-profile';

const stableSubjectSchema = z.string().trim().min(1);

type SignInDenialReason =
  | 'ENTRA_CLAIMS_INVALID'
  | 'ENTRA_SUBJECT_MISSING'
  | 'ENTRA_SUBJECT_MISMATCH'
  | 'ENTRA_CALLBACK_UNSUPPORTED'
  | 'ENTRA_ALLOWLIST_MISMATCH';

function reportSignInDenial(reason: SignInDenialReason): void {
  console.warn(`AUTH_DENIED:${reason}`);
}

function profileSubject(profile: unknown): unknown {
  return profile && typeof profile === 'object' && 'sub' in profile ? profile.sub : undefined;
}

function mapEntraProfile(profile: unknown) {
  try {
    return entraUserFromOidcClaims(profile);
  } catch {
    const reason = stableSubjectSchema.safeParse(profileSubject(profile)).success
      ? 'ENTRA_CLAIMS_INVALID'
      : 'ENTRA_SUBJECT_MISSING';
    reportSignInDenial(reason);
    throw new Error('Entra identity claims are invalid.');
  }
}

function entraIdentityFromCallback(
  account: { provider: string; providerAccountId: string; type: string } | null | undefined,
  profile: unknown,
) {
  if (account?.provider !== 'microsoft-entra-id' || account.type !== 'oidc') {
    return { identity: null, reason: 'ENTRA_CALLBACK_UNSUPPORTED' } as const;
  }

  if (!stableSubjectSchema.safeParse(profileSubject(profile)).success) {
    return { identity: null, reason: 'ENTRA_SUBJECT_MISSING' } as const;
  }

  const accountSubject = stableSubjectSchema.safeParse(account.providerAccountId);
  if (!accountSubject.success) {
    return { identity: null, reason: 'ENTRA_SUBJECT_MISSING' } as const;
  }

  try {
    const identity = entraUserFromOidcClaims(profile);
    if (identity.id !== accountSubject.data) {
      return { identity: null, reason: 'ENTRA_SUBJECT_MISMATCH' } as const;
    }
    return { identity, reason: null } as const;
  } catch {
    return { identity: null, reason: 'ENTRA_CLAIMS_INVALID' } as const;
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
        profile: mapEntraProfile,
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
        const result = entraIdentityFromCallback(account, profile);
        if (result.reason) {
          reportSignInDenial(result.reason);
          return false;
        }
        if (!isAllowedEntraIdentity(result.identity, environment)) {
          reportSignInDenial('ENTRA_ALLOWLIST_MISMATCH');
          return false;
        }
        return true;
      },
      jwt({ token, user, account, profile }) {
        if (user) {
          const result = entraIdentityFromCallback(account, profile);
          if (result.reason) {
            reportSignInDenial(result.reason);
            return null;
          }
          token.sub = result.identity.id;
          token.entraSubject = result.identity.id;
          token.email = result.identity.email;
          token.entraOid = result.identity.oid;
          token.entraTid = result.identity.tid;
        }
        return token;
      },
      session({ session, token }) {
        const subject = stableSubjectSchema.safeParse(token.sub);
        const persistedSubject = stableSubjectSchema.safeParse(token.entraSubject);
        const objectId = z.uuid().safeParse(token.entraOid);
        const tenantId = z.uuid().safeParse(token.entraTid);
        const validSubject =
          subject.success && persistedSubject.success && subject.data === persistedSubject.data;
        return {
          ...session,
          user: {
            ...session.user,
            id: validSubject ? subject.data : undefined,
            oid: validSubject && objectId.success ? objectId.data : undefined,
            tid: validSubject && tenantId.success ? tenantId.data : undefined,
          },
        };
      },
    },
  };
}

// Auth.js invokes this initializer for an incoming auth request. Keeping the
// call inside the callback prevents local credentials being read during build.
export const { auth, handlers, signIn, signOut } = NextAuth(() => createAuthConfig());
