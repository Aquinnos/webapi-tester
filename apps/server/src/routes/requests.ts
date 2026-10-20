import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import {
  forwardRequest,
  ProxyForwardError,
} from '../services/proxy-forward.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import type { ProxyForwardRequestDto } from '@webapi-tester/shared';

export const requestsRouter: ReturnType<typeof Router> = Router();

const forwardSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']),
  url: z.string().min(1).max(2048),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().default(''),
  bodyEncoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  baseUrl: z.string().optional(),
});

const MAX_HISTORY_BODY = 50_000;

requestsRouter.post('/proxy/forward', requireAuth, async (req, res, next) => {
  try {
    const dto = forwardSchema.parse(req.body) as ProxyForwardRequestDto;
    const response = await forwardRequest(dto);

    const pool = getPool();
    const userId = Number(req.user!.id);
    const decodedText = Buffer.from(response.bodyBase64, 'base64').toString(
      'utf-8',
    );
    const truncated =
      decodedText.length > MAX_HISTORY_BODY
        ? decodedText.slice(0, MAX_HISTORY_BODY)
        : decodedText;

    try {
      await pool.query(
        `INSERT INTO request_history
   (user_id, request_id, method, url, status_code, response_time_ms, response_body)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          null,
          dto.method,
          dto.url,
          response.status,
          response.durationMs,
          truncated,
        ],
      );
    } catch (historyErr) {
      console.warn(
        '[history] save failed (request still succeeded):',
        historyErr instanceof Error ? historyErr.message : historyErr,
      );
    }

    res.json(response);
  } catch (err) {
    if (err instanceof ProxyForwardError) {
      return next(new HttpError(err.status, err.message));
    }
    next(err);
  }
});
