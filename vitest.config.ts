import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@tossguide/shared': fileURLToPath(new URL('./shared/src', import.meta.url)) },
  },
  test: {
    include: ['shared/test/**/*.test.ts', 'tests/blind/**/*.test.ts', 'client/test/**/*.test.ts', 'server/test/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['shared/src/**'],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
