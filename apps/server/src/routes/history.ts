import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import type { HistoryEntryDto } from '@webapi-tester/shared';

export const historyRouter: ReturnType<typeof Router> = Router();

interface HistoryRow {
  id: number;
  user_id: number;
  request_id: number | null;
  method: string;
  url: string;
  status_code: number;
  response_time_ms: number;
  response_body: string;
  executed_at: Date;
}

function historyFromRow(row: HistoryRow): HistoryEntryDto {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    requestId: row.request_id !== null ? String(row.request_id) : null,
    method: row.method as HistoryEntryDto['method'],
    url: row.url,
    status: row.status_code,
    durationMs: row.response_time_ms,
    body: row.response_body,
    timestamp: row.executed_at.toISOString(),
  };
}

historyRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const pool = getPool();
    const userId = Number(req.user!.id);
    const result = await pool.query<HistoryRow>(
      `SELECT id, user_id, request_id, method, url, status_code,
                response_time_ms, response_body, executed_at
         FROM request_history
         WHERE user_id = $1
         ORDER BY executed_at DESC
         LIMIT 200`,
      [userId],
    );
    res.json({ entries: result.rows.map(historyFromRow) });
  } catch (err) {
    next(err);
  }
});

historyRouter.delete('/history/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      throw new HttpError(400, 'Invalid id');
    const pool = getPool();
    const userId = Number(req.user!.id);
    const result = await pool.query(
      `DELETE FROM request_history WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (result.rowCount === 0)
      throw new HttpError(404, 'History entry not found');
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
