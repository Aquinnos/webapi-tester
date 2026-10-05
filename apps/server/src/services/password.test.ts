import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('Password service', () => {
  it('hashes a password (not equal to plaintext)', async () => {
    const hash = await hashPassword('correctPassword');
    expect(hash).not.toBe('correctPassword');
    expect(hash.startsWith('$2a$')).toBe(true);
    expect(hash.length).toBeGreaterThan(40);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('correctPassword');
    await expect(verifyPassword('correctPassword', hash)).resolves.toBe(true);
  });

  it('fails to verify an incorrect password', async () => {
    const hash = await hashPassword('correctPassword');
    await expect(verifyPassword('wrongPassword', hash)).resolves.toBe(false);
  });
});
