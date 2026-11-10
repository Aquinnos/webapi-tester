import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { allowedImportHosts } from '../config.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export class UrlNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlNotAllowedError';
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4) return false;
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a = 0, b = 0, c = 0] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80')) return true;
  if (/^f[cd]/.test(lower)) return true;
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice('::ffff:'.length);
    return isIP(mapped) === 4 ? isPrivateIPv4(mapped) : true;
  }
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

async function resolveAddresses(host: string): Promise<string[]> {
  if (isIP(host)) return [host];
  try {
    const records = await lookup(host, { all: true });
    return records.map((record) => record.address);
  } catch {
    throw new UrlNotAllowedError(
      `Nie udało się rozwiązać nazwy hosta: ${host}`,
    );
  }
}

// Import specyfikacji z adresu URL oznacza pobieranie zasobu z sieci przez
// serwer, więc adres musi wskazywać na host publiczny, inaczej serwer
// dostałby się do zasobów wewnątrz sieci (SSRF).
export async function assertImportUrlAllowed(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlNotAllowedError('Nieprawidłowy adres URL specyfikacji');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UrlNotAllowedError(
      'Dozwolone są wyłącznie adresy http oraz https',
    );
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (allowedImportHosts.length > 0 && !allowedImportHosts.includes(host)) {
    throw new UrlNotAllowedError(
      `Host ${host} nie znajduje się na liście dozwolonych adresów importu`,
    );
  }

  const addresses = await resolveAddresses(host);
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new UrlNotAllowedError(
        'Adres wskazuje na host wewnętrzny sieci i został zablokowany',
      );
    }
  }

  return url;
}
