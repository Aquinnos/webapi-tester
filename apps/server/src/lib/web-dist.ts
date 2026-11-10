import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const WORKSPACE_MARKER = 'pnpm-workspace.yaml';

function findWorkspaceRoot(startDir: string): string | null {
  let dir = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, WORKSPACE_MARKER))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Zwraca katalog ze zbudowanym frontendem albo null, gdy build frontu
// nie jest dostępny (np. w środowisku deweloperskim).
export function resolveWebDistDir(): string | null {
  if (config.WEB_DIST_DIR) {
    const configured = resolve(config.WEB_DIST_DIR);
    return existsSync(join(configured, 'index.html')) ? configured : null;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = findWorkspaceRoot(here);
  if (!workspaceRoot) return null;

  const candidate = join(workspaceRoot, 'apps', 'web', 'dist');
  return existsSync(join(candidate, 'index.html')) ? candidate : null;
}
