import { describe, it, expect, vi, beforeEach } from 'vitest';

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
}));

import {
  assertImportUrlAllowed,
  isBlockedAddress,
  UrlNotAllowedError,
} from './ssrf-guard.js';

describe('isBlockedAddress', () => {
  it('blokuje adresy hosta lokalnego i sieci prywatnej', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('10.1.2.3')).toBe(true);
    expect(isBlockedAddress('172.16.0.5')).toBe(true);
    expect(isBlockedAddress('192.168.1.10')).toBe(true);
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
    expect(isBlockedAddress('::1')).toBe(true);
    expect(isBlockedAddress('fd00::1')).toBe(true);
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('nie blokuje adresów publicznych', () => {
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
    expect(isBlockedAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });
});

describe('assertImportUrlAllowed', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  it('przepuszcza adres http hosta publicznego', async () => {
    await expect(
      assertImportUrlAllowed('http://example.com/openapi.json'),
    ).resolves.toBeInstanceOf(URL);
  });

  it('odrzuca adres z protokołem innym niż http i https', async () => {
    await expect(
      assertImportUrlAllowed('file:///etc/passwd'),
    ).rejects.toThrow(UrlNotAllowedError);
  });

  it('odrzuca niepoprawny adres', async () => {
    await expect(assertImportUrlAllowed('nie-adres')).rejects.toThrow(
      UrlNotAllowedError,
    );
  });

  it('odrzuca adres wskazujący na host lokalny', async () => {
    await expect(
      assertImportUrlAllowed('http://127.0.0.1:3002/health'),
    ).rejects.toThrow(/wewnętrzny/);
  });

  it('odrzuca host, który wskazuje na adres sieci prywatnej', async () => {
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    await expect(
      assertImportUrlAllowed('http://wewnetrzny.example.com/openapi.json'),
    ).rejects.toThrow(/wewnętrzny/);
  });

  it('odrzuca host, którego nie da się rozwiązać', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(
      assertImportUrlAllowed('http://nieistniejacy.example.com/openapi.json'),
    ).rejects.toThrow(/rozwiązać/);
  });
});
