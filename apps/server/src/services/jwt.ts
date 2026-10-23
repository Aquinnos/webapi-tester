import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import type { AccessTokenPayload } from '@webapi-tester/shared';

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

export function signAccessToken(userId: string, email: string): string {
  const payload = { sub: userId, email, type: 'access' as const };
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: config.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.JWT_SECRET_KEY, options);
}

export function signRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, type: 'refresh' };
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: config.JWT_REFRESH_TTL as SignOptions['expiresIn'],
    jwtid: randomUUID(),
  };
  return jwt.sign(payload, config.JWT_SECRET_KEY, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET_KEY);
  if (
    typeof decoded === 'string' ||
    (decoded as { type?: string }).type !== 'access'
  ) {
    throw new Error('Invalid token type');
  }
  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET_KEY);
  if (
    typeof decoded === 'string' ||
    (decoded as { type?: string }).type !== 'refresh'
  ) {
    throw new Error('Invalid token type');
  }
  return decoded as RefreshTokenPayload;
}