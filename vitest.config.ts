import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@binsight/shared': fileURLToPath(new URL('./shared/src', import.meta.url)) },
  },
  test: {
    include: ['shared/test/**/*.test.ts', 'tests/blind/**/*.test.ts', 'client/test/**/*.test.ts', 'server/test/**/*.test.ts'],
    // The server is built in Phase 2 (aditya/leaderboard-backend). Its blind tests are
    // written already. Remove this exclude when server/src/app.ts exists.
    exclude: ['**/node_modules/**', 'tests/blind/server.blind.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['shared/src/**'],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
