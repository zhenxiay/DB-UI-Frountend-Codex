import { z } from 'zod';

const entraOidcProfileSchema = z.object({
  sub: z.string().trim().min(1),
  name: z.string().trim().min(1).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

/** Map claims from Auth.js's validated OIDC token without contacting Graph. */
export function entraUserFromOidcClaims(claims: unknown) {
  const profile = entraOidcProfileSchema.parse(claims);

  return {
    id: profile.sub,
    name: profile.name ?? null,
    email: profile.email ?? null,
    image: null,
  };
}
