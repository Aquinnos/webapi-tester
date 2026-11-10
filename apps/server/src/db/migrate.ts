import { applySchema } from './schema.js';
import { closePool } from './pool.js';

applySchema()
  .then(async () => {
    console.log('[migrate] schema applied');
  })
  .then(() => closePool())
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('[migrate] failed:', err);
    void closePool().then(() => {
      process.exit(1);
    });
  });
