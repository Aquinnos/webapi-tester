import express, { type Express, type Request, type Response } from 'express';
import { config } from './config.js';

function build(): Express {
  const app = express();

  // Proxy nie używa parsera body - przekazuje surowe żądania.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'proxy' });
  });

  return app;
}

const app = build();

app.listen(config.PROXY_PORT, () => {
  console.log(`[proxy] listening on http://localhost:${config.PROXY_PORT}`);
});