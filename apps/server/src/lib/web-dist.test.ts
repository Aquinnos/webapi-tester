import { describe, it, expect, vi, afterEach } from 'vitest';

const FIXTURE_DIR = `${process.cwd()}/test-fixtures/web-dist`;

afterEach(() => {
  vi.resetModules();
  delete process.env.WEB_DIST_DIR;
});

describe('resolveWebDistDir', () => {
  it('zwraca null, gdy wskazany katalog nie zawiera zbudowanego frontu', async () => {
    process.env.WEB_DIST_DIR = `${process.cwd()}/test-fixtures/nieistniejacy`;
    vi.resetModules();

    const { resolveWebDistDir } = await import('./web-dist.js');

    expect(resolveWebDistDir()).toBeNull();
  });

  it('zwraca wskazany katalog ze zbudowanym frontendem', async () => {
    process.env.WEB_DIST_DIR = FIXTURE_DIR;
    vi.resetModules();

    const { resolveWebDistDir } = await import('./web-dist.js');

    expect(resolveWebDistDir()).toBe(FIXTURE_DIR);
  });

  it('szuka zbudowanego frontu w repozytorium, gdy nic nie skonfigurowano', async () => {
    vi.resetModules();

    const { resolveWebDistDir } = await import('./web-dist.js');
    const dir = resolveWebDistDir();

    expect(dir === null || dir.endsWith('apps/web/dist')).toBe(true);
  });
});
