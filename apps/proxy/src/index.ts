import express, { type Express, type Request, type Response } from 'express';
import { config } from './config.js';
import { forwardRouter } from './routes/forward.js';

function build(): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'proxy' });
  });

  app.use('/', forwardRouter);

  return app;
}

const app = build();

app.listen(config.PROXY_PORT, '127.0.0.1', () => {
  console.log(`[proxy] listening on http://127.0.0.1:${config.PROXY_PORT}`);
});
