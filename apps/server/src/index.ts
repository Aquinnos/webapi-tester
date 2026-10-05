import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { errorHandler } from './middleware/error.js';
import { requestsRouter } from './routes/requests.js';

function build(): Express {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use('/auth', authRouter);
  app.use(requestsRouter);
  app.use(errorHandler);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'server' });
  });

  return app;
}

const app = build();

app.listen(config.SERVER_PORT, () => {
  console.log(`[server] listening on http://localhost:${config.SERVER_PORT}`);
});
