import { Pool } from 'pg';
import { config } from '../config.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.POSTGRES_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
    pool.on('error', (err: Error) => {
      console.error('[db] unexpected error on idle client', err);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function shutdown(signal: string): void {
  console.log(`[db] received ${signal}, closing pool`);
  void closePool().then(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});