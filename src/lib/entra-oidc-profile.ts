import { z } from 'zod';

const entraOidcProfileSchema = z.object({
  sub: z.string().trim().min(1),
  name: z.string().trim().min(1).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  preferred_username: z.unknown().optional(),
});

/** Map claims from Auth.js's validated OIDC token without contacting Graph. */
export function entraUserFromOidcClaims(claims: unknown) {
  const profile = entraOidcProfileSchema.parse(claims);
  const preferredUsername = z.string().trim().email().safeParse(profile.preferred_username);

  return {
    id: profile.sub,
    name: profile.name ?? null,
    email: profile.email ?? (preferredUsername.success ? preferredUsername.data : null),
    image: null,
  };
}
