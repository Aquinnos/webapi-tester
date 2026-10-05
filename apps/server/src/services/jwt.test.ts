import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.js';

describe('JWT service', () => {
  it('round trips access token', () => {
    const token = signAccessToken('123', 'user@example.com');
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('123');
    expect(decoded.email).toBe('user@example.com');
    expect(decoded.type).toBe('access');
  });

  it('round trips refresh token', () => {
    const token = signRefreshToken('456');
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe('456');
    expect(decoded.type).toBe('refresh');
  });

  it('rejects access token used as refresh', () => {
    const token = signAccessToken('123', 'a@b.c');
    expect(() => verifyRefreshToken(token)).toThrow();
  });

  it('rejects refresh token used as access', () => {
    const token = signRefreshToken('456');
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects garbage strings', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow();
  });
});
