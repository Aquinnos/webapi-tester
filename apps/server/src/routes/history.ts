import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import type {
  HistoryEntryDto,
  HistoryListItemDto,
  RecordHistoryDto,
  RecordHistoryResultDto,
} from '@webapi-tester/shared';

export const historyRouter: ReturnType<typeof Router> = Router();

const MAX_BODY_LENGTH = 50_000;

const recordSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
  url: z.string().min(1).max(2048),
  status: z.number().int().min(100).max(599),
  durationMs: z.number().int().min(0),
  body: z.string().default(''),
});

interface HistoryRow {
  id: number;
  user_id: number;
  method: string;
  url: string;
  status_code: number;
  response_time_ms: number;
  response_body: string;
  executed_at: Date;
}

function historyListItemFromRow(row: HistoryRow): HistoryListItemDto {
  return {
    id: String(row.id),
    method: row.method as HistoryListItemDto['method'],
    url: row.url,
    status: row.status_code,
    durationMs: row.response_time_ms,
    timestamp: row.executed_at.toISOString(),
  };
}

function historyFromRow(row: HistoryRow): HistoryEntryDto {
  return {
    ...historyListItemFromRow(row),
    userId: String(row.user_id),
    body: row.response_body,
  };
}

historyRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const pool = getPool();
    const userId = Number(req.user!.id);
    const result = await pool.query<HistoryRow>(
      `SELECT id, user_id, method, url, status_code,
                response_time_ms, response_body, executed_at
         FROM request_history
         WHERE user_id = $1
         ORDER BY executed_at DESC
         LIMIT 1000`,
      [userId],
    );
    res.json({ entries: result.rows.map(historyListItemFromRow) });
  } catch (err) {
    next(err);
  }
});

historyRouter.get('/history/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Nieprawidłowy identyfikator');
    const pool = getPool();
    const userId = Number(req.user!.id);
    const result = await pool.query<HistoryRow>(
      `SELECT id, user_id, method, url, status_code,
                response_time_ms, response_body, executed_at
         FROM request_history
         WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'Wpis historii nie został znaleziony');
    res.json(historyFromRow(row));
  } catch (err) {
    next(err);
  }
});

historyRouter.post('/history', requireAuth, async (req, res, next) => {
  try {
    const dto = recordSchema.parse(req.body) as RecordHistoryDto;
    const pool = getPool();
    const userId = Number(req.user!.id);
    const result = await pool.query<{ id: number; executed_at: Date }>(
      `INSERT INTO request_history
         (user_id, method, url, status_code, response_time_ms, response_body)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, executed_at`,
      [
        userId,
        dto.method,
        dto.url,
        dto.status,
        dto.durationMs,
        dto.body.slice(0, MAX_BODY_LENGTH),
      ],
    );
    const row = result.rows[0]!;
    const body: RecordHistoryResultDto = {
      id: String(row.id),
      executedAt: row.executed_at.toISOString(),
    };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
});

historyRouter.delete('/history/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      throw new HttpError(400, 'Nieprawidłowy identyfikator');
    const pool = getPool();
    const userId = Number(req.user!.id);
    const result = await pool.query(
      `DELETE FROM request_history WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (result.rowCount === 0)
      throw new HttpError(404, 'Wpis historii nie został znaleziony');
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

historyRouter.delete('/history', requireAuth, async (req, res, next) => {
  try {
    const pool = getPool();
    const userId = Number(req.user!.id);
    await pool.query(`DELETE FROM request_history WHERE user_id = $1`, [
      userId,
    ]);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});
