import { z } from 'zod';

const authEnvironmentSchema = z.object({
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must contain at least 32 characters.'),
  ENTRA_TENANT_ID: z.string().uuid('ENTRA_TENANT_ID must be a tenant UUID.'),
  ENTRA_CLIENT_ID: z.string().uuid('ENTRA_CLIENT_ID must be an application UUID.'),
  ENTRA_CLIENT_SECRET: z.string().min(1, 'ENTRA_CLIENT_SECRET is required.'),
});

export type AuthEnvironment = z.infer<typeof authEnvironmentSchema>;

/**
 * Validates only the configuration Auth.js needs. This is intentionally called
 * when Auth.js handles a request rather than while Next.js is building routes.
 */
export function readAuthEnvironment(environment: NodeJS.ProcessEnv = process.env): AuthEnvironment {
  return authEnvironmentSchema.parse(environment);
}
