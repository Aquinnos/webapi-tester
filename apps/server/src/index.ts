import { build } from './app.js';
import { config, port } from './config.js';
import { applySchema } from './db/schema.js';

async function bootstrap(): Promise<void> {
  if (config.RUN_MIGRATIONS_ON_START) {
    await applySchema();
  }

  const app = build();
  app.listen(port, config.BIND_HOST, () => {
    console.log(`[server] listening on http://${config.BIND_HOST}:${port}`);
  });
}

bootstrap().catch((err: unknown) => {
  console.error('[server] startup failed:', err);
  process.exit(1);
});
