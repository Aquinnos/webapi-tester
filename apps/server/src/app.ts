import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { join } from 'node:path';
import { allowedOrigins } from './config.js';
import { authRouter } from './routes/auth.js';
import { errorHandler } from './middleware/error.js';
import { collectionsRouter } from './routes/collections.js';
import { historyRouter } from './routes/history.js';
import { openapiRouter } from './routes/openapi.js';
import { resolveWebDistDir } from './lib/web-dist.js';

export const API_PREFIX = '/api';

function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  // Bez listy dozwolonych originów API odbija każdy origin (tryb deweloperski).
  if (allowedOrigins.length === 0) {
    callback(null, true);
    return;
  }
  if (origin && allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
}

function buildAuthLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: 'Zbyt wiele prób, spróbuj ponownie za kilka minut',
    },
  });
}

export function build(): Express {
  const app = express();
  app.disable('x-powered-by');
  // Usługa stoi za proxy platformy, więc bez tego adres IP klienta byłby
  // adresem proxy, a limit zapytań liczony byłby dla wszystkich naraz.
  app.set('trust proxy', 1);

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'server' });
  });
  app.get(`${API_PREFIX}/health`, (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'server' });
  });

  app.use(`${API_PREFIX}/auth`, buildAuthLimiter(), authRouter);
  app.use(API_PREFIX, collectionsRouter);
  app.use(API_PREFIX, openapiRouter);
  app.use(API_PREFIX, historyRouter);

  app.use(API_PREFIX, (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Nie znaleziono zasobu' });
  });

  const webDistDir = resolveWebDistDir();
  if (webDistDir) {
    app.use(express.static(webDistDir, { index: false, maxAge: '1h' }));
    // Trasy aplikacji jednostronicowej obsługuje fallback na index.html.
    app.get(/^(?!\/api(?:\/|$)|\/health$).*/, (_req: Request, res: Response) => {
      res.sendFile(join(webDistDir, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
