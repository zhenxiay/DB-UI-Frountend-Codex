import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    // `server-only` intentionally throws in Vitest's jsdom environment. The
    // production module still imports the real package; this alias only
    // replaces its runtime guard while exercising server code in tests.
    alias: {
      'server-only': resolve(__dirname, 'tests/server-only-stub.ts'),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
