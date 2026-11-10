import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './pool.js';

// Schemat jest idempotentny (CREATE TABLE IF NOT EXISTS), więc można go
// stosować przy każdym starcie usługi bez ryzyka nadpisania danych.
export async function applySchema(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const schema = await readFile(resolve(here, 'schema.sql'), 'utf-8');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(schema);
  } finally {
    client.release();
  }
}
