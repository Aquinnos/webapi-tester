import { describe, expect, it } from 'vitest';
import { statusTextFor } from './http-status.js';

describe('statusTextFor', () => {
  it('returns the phrase sent by the server when it is present', () => {
    expect(statusTextFor(200, 'OK')).toBe('OK');
  });

  it('prefers the server phrase over the standard one', () => {
    expect(statusTextFor(404, 'Nie znaleziono')).toBe('Nie znaleziono');
  });

  it('falls back to the standard phrase when the server sends none', () => {
    expect(statusTextFor(200, '')).toBe('OK');
    expect(statusTextFor(404)).toBe('Not Found');
  });

  it('treats a whitespace-only phrase as missing', () => {
    expect(statusTextFor(500, '   ')).toBe('Internal Server Error');
  });

  it('returns an empty string for a status with no known phrase', () => {
    expect(statusTextFor(599)).toBe('');
  });
});
