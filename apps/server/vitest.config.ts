import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../.env') });

process.env.POSTGRES_URL =
  process.env.POSTGRES_TEST_URL ??
  'postgresql://webapi:webapi@localhost:5433/webapi_tester_test';

export default defineConfig({
  test: { fileParallelism: false },
});
