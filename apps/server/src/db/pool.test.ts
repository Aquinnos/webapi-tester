import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './pool.js';

interface CountRow {
  count: string;
}
interface OkRow {
  ok: number;
}
interface TableRow {
  table_name: string;
}

describe('database pool + migrations', () => {
  beforeAll(async () => {
    const pool = getPool();
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = await readFile(resolve(here, 'schema.sql'), 'utf-8');
    await pool.query(schema);
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await closePool();
  });

  it('connects and executes a simple query', async () => {
    const pool = getPool();
    const result = await pool.query<OkRow>('SELECT 1::int AS ok');
    expect(result.rows[0]?.ok).toBe(1);
  });

  it('users table exists and is empty', async () => {
    const pool = getPool();
    const result = await pool.query<CountRow>(
      'SELECT count(*)::text AS count FROM users',
    );
    expect(result.rows[0]?.count).toBe('0');
  });

  it('all 4 tables from ERD are present', async () => {
    const pool = getPool();
    const result = await pool.query<TableRow>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('users', 'collections', 'requests', 'request_history')
       ORDER BY table_name`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'collections',
      'request_history',
      'requests',
      'users',
    ]);
  });

  it('history FK to requests allows NULL (ad-hoc queries)', async () => {
    const pool = getPool();
    const result = await pool.query<CountRow>(
      `SELECT count(*)::text AS count FROM request_history WHERE request_id IS NULL`,
    );
    expect(result.rows[0]?.count).toBe('0');
  });
});
