import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './pool.js';

async function migrate(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const schemaPath = resolve(here, 'schema.sql');
  const schema = await readFile(schemaPath, 'utf-8');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const start = Date.now();
    await client.query(schema);
    const elapsed = Date.now() - start;
    console.log(`[migrate] schema applied in ${elapsed} ms`);
  } finally {
    client.release();
  }
}

migrate()
  .then(() => closePool())
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('[migrate] failed:', err);
    void closePool().then(() => {
      process.exit(1);
    });
  });