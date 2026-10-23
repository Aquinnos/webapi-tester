import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getPool } from '../db/pool.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiryOf(token: string): Date {
  const decoded = jwt.decode(token);
  const exp =
    typeof decoded === 'object' && decoded !== null ? decoded.exp : undefined;
  if (typeof exp !== 'number') {
    throw new Error('Refresh token without expiry');
  }
  return new Date(exp * 1000);
}

export async function storeRefreshToken(
  userId: number,
  token: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashToken(token), expiryOf(token)],
  );
}

export async function isRefreshTokenActive(
  userId: number,
  token: string,
): Promise<boolean> {
  const result = await getPool().query(
    `SELECT 1 FROM refresh_tokens
     WHERE user_id = $1
       AND token_hash = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [userId, hashToken(token)],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function revokeRefreshToken(
  userId: number,
  token: string,
): Promise<void> {
  await getPool().query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
    [userId, hashToken(token)],
  );
}