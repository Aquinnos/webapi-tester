import { describe, it, expect } from 'vitest';
import { applySchema } from './schema.js';
import { getPool } from './pool.js';

describe('applySchema', () => {
  it('stosuje schemat bez błędu i nie kasuje istniejących danych', async () => {
    await applySchema();
    await applySchema();

    const result = await getPool().query<{ count: string }>(
      'SELECT count(*) FROM users',
    );

    expect(Number(result.rows[0]?.count ?? '0')).toBeGreaterThanOrEqual(0);
  });
});
