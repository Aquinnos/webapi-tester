import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Skrypt migracji szuka pliku schema.sql obok siebie, a kompilator TypeScript
// kopiuje wyłącznie pliki .ts, więc schemat trzeba przenieść do dist ręcznie.
const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../src/db/schema.sql');
const target = resolve(here, '../dist/db/schema.sql');

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
