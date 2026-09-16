import { defineConfig } from 'drizzle-kit';

import { getSqlitePath } from './src/server/db/env';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: getSqlitePath(),
  },
});
