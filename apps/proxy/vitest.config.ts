import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 80,
        lines: 80,
      },
    },
  },
});
