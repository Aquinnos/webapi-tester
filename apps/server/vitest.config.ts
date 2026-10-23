import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../.env') });

process.env.POSTGRES_URL =
  process.env.POSTGRES_TEST_URL ??
  'postgresql://webapi:webapi@localhost:5433/webapi_tester_test';

export default defineConfig({
  test: {
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/migrate.ts'],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 80,
        lines: 80,
      },
    },
  },
});
