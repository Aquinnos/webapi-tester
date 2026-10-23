import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { getPool, closePool } from '../db/pool.js';
import { config } from '../config.js';
import { signRefreshToken } from './jwt.js';
import {
  isRefreshTokenActive,
  revokeRefreshToken,
  storeRefreshToken,
} from './refresh-token-store.js';

const OWNER_ID = 1;
const OTHER_USER_ID = 2;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function tokenExpiringIn(seconds: number): string {
  return jwt.sign(
    {
      sub: String(OWNER_ID),
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + seconds,
      jti: randomUUID(),
    },
    config.JWT_SECRET_KEY,
    { algorithm: 'HS256', noTimestamp: true },
  );
}

describe('refresh token store', () => {
  const pool = getPool();

  beforeAll(async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = await readFile(resolve(here, '../db/schema.sql'), 'utf-8');
    await pool.query(schema);
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
    await pool.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, 'unused'), ($3, $4, 'unused')`,
      [OWNER_ID, 'owner@example.com', OTHER_USER_ID, 'other@example.com'],
    );
  });

  afterAll(async () => {
    await closePool();
  });

  it('stores only the SHA-256 hash, never the raw token', async () => {
    const token = signRefreshToken(String(OWNER_ID));
    await storeRefreshToken(OWNER_ID, token);

    const stored = await pool.query<{ token_hash: string }>(
      'SELECT token_hash FROM refresh_tokens WHERE user_id = $1',
      [OWNER_ID],
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]!.token_hash).toBe(sha256(token));
    expect(stored.rows[0]!.token_hash).not.toContain(token);
  });

  it('derives the stored expiry from the token exp claim', async () => {
    const seconds = 3600;
    const token = tokenExpiringIn(seconds);
    await storeRefreshToken(OWNER_ID, token);

    const stored = await pool.query<{ expires_at: Date }>(
      'SELECT expires_at FROM refresh_tokens WHERE token_hash = $1',
      [sha256(token)],
    );
    const expected = Math.floor(Date.now() / 1000) + seconds;
    expect(Math.abs(stored.rows[0]!.expires_at.getTime() / 1000 - expected)).toBeLessThan(5);
  });

  it('rejects a token carrying no expiry claim', async () => {
    const withoutExp = jwt.sign(
      { sub: String(OWNER_ID), type: 'refresh' },
      config.JWT_SECRET_KEY,
      { algorithm: 'HS256', noTimestamp: true },
    );
    await expect(storeRefreshToken(OWNER_ID, withoutExp)).rejects.toThrow(
      'Refresh token without expiry',
    );
  });

  it('reports a freshly stored token as active', async () => {
    const token = signRefreshToken(String(OWNER_ID));
    await storeRefreshToken(OWNER_ID, token);
    expect(await isRefreshTokenActive(OWNER_ID, token)).toBe(true);
  });

  it('reports a revoked token as inactive', async () => {
    const token = signRefreshToken(String(OWNER_ID));
    await storeRefreshToken(OWNER_ID, token);
    await revokeRefreshToken(OWNER_ID, token);
    expect(await isRefreshTokenActive(OWNER_ID, token)).toBe(false);
  });

  it('reports a token that was never issued as inactive', async () => {
    const forged = tokenExpiringIn(3600);
    expect(await isRefreshTokenActive(OWNER_ID, forged)).toBe(false);
  });

  it('reports an expired token as inactive', async () => {
    const expired = tokenExpiringIn(-3600);
    await storeRefreshToken(OWNER_ID, expired);
    expect(await isRefreshTokenActive(OWNER_ID, expired)).toBe(false);
  });

  it('does not treat another user token as active for this user', async () => {
    const foreign = signRefreshToken(String(OTHER_USER_ID));
    await storeRefreshToken(OTHER_USER_ID, foreign);
    expect(await isRefreshTokenActive(OWNER_ID, foreign)).toBe(false);
    expect(await isRefreshTokenActive(OTHER_USER_ID, foreign)).toBe(true);
  });

  it('keeps revocation idempotent and preserves the first timestamp', async () => {
    const token = signRefreshToken(String(OWNER_ID));
    await storeRefreshToken(OWNER_ID, token);
    await revokeRefreshToken(OWNER_ID, token);
    const first = await pool.query<{ revoked_at: Date }>(
      'SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1',
      [sha256(token)],
    );
    await pool.query('SELECT pg_sleep(0.05)');
    await revokeRefreshToken(OWNER_ID, token);
    const second = await pool.query<{ revoked_at: Date }>(
      'SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1',
      [sha256(token)],
    );
    expect(second.rows[0]!.revoked_at.getTime()).toBe(first.rows[0]!.revoked_at.getTime());
  });
});