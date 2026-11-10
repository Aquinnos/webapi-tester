import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const MIN_KEY_LENGTH = 16;

export type AgentKeySource = 'env' | 'file' | 'generated';

export interface AgentKey {
  value: string;
  source: AgentKeySource;
  path: string;
}

function generateKey(): string {
  return randomBytes(32).toString('hex');
}

function readStoredKey(path: string): string | undefined {
  try {
    const stored = readFileSync(path, 'utf8').trim();
    return stored.length >= MIN_KEY_LENGTH ? stored : undefined;
  } catch {
    return undefined;
  }
}

// Kolejność: zmienna środowiskowa, potem zapisany klucz, a gdy żadnego nie ma,
// generujemy nowy i zapisujemy go, aby po restarcie pozostał bez zmian.
export function resolveAgentKey(
  envSecret: string | undefined,
  keyFile: string,
): AgentKey {
  const path = resolve(keyFile);

  if (envSecret && envSecret.length >= MIN_KEY_LENGTH) {
    return { value: envSecret, source: 'env', path };
  }

  const stored = readStoredKey(path);
  if (stored) {
    return { value: stored, source: 'file', path };
  }

  const value = generateKey();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${value}\n`, { mode: 0o600 });
  return { value, source: 'generated', path };
}
