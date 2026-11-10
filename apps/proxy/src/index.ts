import express, { type Express, type Request, type Response } from 'express';
import { agentKey, config } from './config.js';
import { forwardRouter } from './routes/forward.js';
import { corsMiddleware } from './services/cors.js';

function build(): Express {
  const app = express();
  app.use(corsMiddleware);
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'proxy' });
  });

  app.use('/', forwardRouter);

  return app;
}

const app = build();

app.listen(config.PROXY_PORT, config.PROXY_BIND_HOST, () => {
  console.log(
    `[proxy] listening on http://${config.PROXY_BIND_HOST}:${config.PROXY_PORT}`,
  );
  console.log(`[proxy] klucz serwera proxy: ${agentKey.value}`);
  console.log(
    '[proxy] wklej ten klucz w polu "Klucz serwera proxy" w aplikacji webowej',
  );
  if (agentKey.source === 'generated') {
    console.log(`[proxy] klucz zapisany w pliku: ${agentKey.path}`);
  }
});
