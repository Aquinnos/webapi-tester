import { Router, type Response } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { forwardRequest, AgentForwardError } from '../services/forward.js';
import type { ProxyForwardRequestDto } from '@webapi-tester/shared';

// keysMatch function to compare the provided key with the expected key in a timing-safe manner.
function keysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const forwardSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']),
  url: z.string().min(1).max(2048),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().default(''),
  bodyEncoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  baseUrl: z.string().optional(),
});

function sendError(
  res: Response,
  status: number,
  error: string,
  details?: string,
) {
  res.status(status).json({ error, ...(details ? { details } : {}) });
}

export const forwardRouter: ReturnType<typeof Router> = Router();

forwardRouter.options('*', (_req, res) => {
  res.status(204).end();
});

// Endpoint sesji pozwala aplikacji webowej sprawdzić klucz bez wysyłania
// realnego żądania do celu.
forwardRouter.get('/session', (req, res) => {
  const providedKey = req.header('X-Proxy-Key');
  if (!providedKey || !keysMatch(providedKey, config.PROXY_SHARED_SECRET)) {
    sendError(res, 401, 'Nieprawidłowy lub brak nagłówka X-Proxy-Key');
    return;
  }
  res.json({ ok: true, service: 'proxy' });
});

forwardRouter.post('/forward', async (req, res) => {
  const providedKey = req.header('X-Proxy-Key');
  if (!providedKey || !keysMatch(providedKey, config.PROXY_SHARED_SECRET)) {
    sendError(res, 401, 'Nieprawidłowy lub brak nagłówka X-Proxy-Key');
    return;
  }

  const parsed = forwardSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(
      res,
      400,
      'Nieprawidłowa treść żądania',
      parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    );
    return;
  }

  try {
    const result = await forwardRequest(parsed.data as ProxyForwardRequestDto);
    res.json(result);
  } catch (err) {
    if (err instanceof AgentForwardError) {
      sendError(res, err.status, err.message);
      return;
    }
    sendError(res, 502, err instanceof Error ? err.message : 'Nieznany błąd');
  }
});
