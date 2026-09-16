import { z } from 'zod';

const databaseEnvironmentSchema = z.object({
  SQLITE_PATH: z.string().trim().min(1, 'SQLITE_PATH must not be empty'),
});

export function getSqlitePath(environment: NodeJS.ProcessEnv = process.env): string {
  const result = databaseEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(
      `Invalid database configuration: ${result.error.issues[0]?.message ?? 'SQLITE_PATH is required'}`,
    );
  }

  return result.data.SQLITE_PATH;
}
