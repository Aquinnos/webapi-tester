import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import type {
  CollectionDto,
  RequestDto,
  CollectionWithRequestsDto,
  CreateCollectionDto,
  UpdateCollectionDto,
  CreateRequestDto,
  UpdateRequestDto,
} from '@webapi-tester/shared';

export const collectionsRouter: ReturnType<typeof Router> = Router();

const collectionSchema = z.object({
  name: z.string().min(1).max(255),
});

const savedRequestSchema = z.object({
  name: z.string().min(1).max(255),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']),
  url: z.string().min(1).max(2048),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().default(''),
  bodyEncoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  baseUrl: z.string().min(1).max(2048).optional(),
});

interface CollectionRow {
  id: number;
  user_id: number;
  name: string;
  created_at: Date;
}

interface RequestRow {
  id: number;
  collection_id: number;
  name: string;
  method: string;
  url: string;
  base_url: string | null;
  headers: Record<string, string>;
  body: string;
  created_at: Date;
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Nieprawidłowy identyfikator');
  }
  return id;
}

function collectionFromRow(row: CollectionRow): CollectionDto {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: row.name,
    createdAt: row.created_at.toISOString(),
  };
}

function requestFromRow(row: RequestRow): RequestDto {
  const dto: RequestDto = {
    id: String(row.id),
    collectionId: String(row.collection_id),
    name: row.name,
    method: row.method as RequestDto['method'],
    url: row.url,
    headers: row.headers,
    body: row.body,
  };
  if (row.base_url) dto.baseUrl = row.base_url;
  return dto;
}

collectionsRouter.get('/collections', requireAuth, async (req, res, next) => {
  try {
    const pool = getPool();
    const userId = Number(req.user!.id);
    const result = await pool.query<CollectionRow>(
      `SELECT id, user_id, name, created_at
         FROM collections
         WHERE user_id = $1
         ORDER BY created_at DESC`,
      [userId],
    );
    res.json(result.rows.map(collectionFromRow));
  } catch (err) {
    next(err);
  }
});

collectionsRouter.post('/collections', requireAuth, async (req, res, next) => {
  try {
    const dto: CreateCollectionDto = collectionSchema.parse(req.body);
    const pool = getPool();
    const userId = Number(req.user!.id);
    const result = await pool.query<CollectionRow>(
      `INSERT INTO collections (user_id, name) VALUES ($1, $2)
         RETURNING id, user_id, name, created_at`,
      [userId, dto.name],
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(500, 'Wstawienie nie zwróciło wiersza');
    res.status(201).json(collectionFromRow(row));
  } catch (err) {
    next(err);
  }
});

collectionsRouter.get(
  '/collections/:id',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id!);
      const pool = getPool();
      const userId = Number(req.user!.id);

      const collResult = await pool.query<CollectionRow>(
        `SELECT id, user_id, name, created_at
         FROM collections
         WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      const collection = collResult.rows[0];
      if (!collection) throw new HttpError(404, 'Kolekcja nie została znaleziona');

      const reqResult = await pool.query<RequestRow>(
        `SELECT id, collection_id, name, method, url, base_url, headers, body, created_at
         FROM requests
         WHERE collection_id = $1
         ORDER BY created_at ASC`,
        [id],
      );

      const dto: CollectionWithRequestsDto = {
        ...collectionFromRow(collection),
        requests: reqResult.rows.map(requestFromRow),
      };
      res.json(dto);
    } catch (err) {
      next(err);
    }
  },
);

collectionsRouter.patch(
  '/collections/:id',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id!);
      const dto: UpdateCollectionDto = collectionSchema.parse(req.body);
      if (!dto.name) throw new HttpError(400, 'nazwa jest wymagana');
      const pool = getPool();
      const userId = Number(req.user!.id);
      const result = await pool.query<CollectionRow>(
        `UPDATE collections SET name = $1
         WHERE id = $2 AND user_id = $3
         RETURNING id, user_id, name, created_at`,
        [dto.name, id, userId],
      );
      const row = result.rows[0];
      if (!row) throw new HttpError(404, 'Kolekcja nie została znaleziona');
      res.json(collectionFromRow(row));
    } catch (err) {
      next(err);
    }
  },
);

collectionsRouter.delete(
  '/collections/:id',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id!);
      const pool = getPool();
      const userId = Number(req.user!.id);
      const result = await pool.query(
        `DELETE FROM collections WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      if (result.rowCount === 0)
        throw new HttpError(404, 'Kolekcja nie została znaleziona');
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  },
);

collectionsRouter.post(
  '/collections/:id/requests',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id!);
      const dto: CreateRequestDto = savedRequestSchema.parse(req.body);
      const pool = getPool();
      const userId = Number(req.user!.id);

      const ownerCheck = await pool.query(
        `SELECT 1 FROM collections WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      if (ownerCheck.rowCount === 0)
        throw new HttpError(404, 'Kolekcja nie została znaleziona');

      const result = await pool.query<RequestRow>(
        `INSERT INTO requests (collection_id, name, method, url, base_url, headers, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, collection_id, name, method, url, base_url, headers, body, created_at`,
        [
          id,
          dto.name,
          dto.method,
          dto.url,
          dto.baseUrl ?? null,
          dto.headers ?? {},
          dto.body ?? '',
        ],
      );
      const row = result.rows[0];
      if (!row) throw new HttpError(500, 'Wstawienie nie zwróciło wiersza');
      res.status(201).json(requestFromRow(row));
    } catch (err) {
      next(err);
    }
  },
);

collectionsRouter.patch(
  '/requests/:id',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id!);
      const dto: UpdateRequestDto = savedRequestSchema.parse(req.body);
      const pool = getPool();
      const userId = Number(req.user!.id);

      const result = await pool.query<RequestRow>(
        `UPDATE requests SET name = $1, method = $2, url = $3, base_url = $4, headers = $5, body = $6
         FROM collections c
         WHERE requests.id = $7
           AND requests.collection_id = c.id
           AND c.user_id = $8
         RETURNING requests.id, requests.collection_id, requests.name,
                   requests.method, requests.url, requests.base_url,
                   requests.headers, requests.body, requests.created_at`,
        [
          dto.name,
          dto.method,
          dto.url,
          dto.baseUrl ?? null,
          dto.headers ?? {},
          dto.body ?? '',
          id,
          userId,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new HttpError(404, 'Zapytanie nie zostało znalezione');
      res.json(requestFromRow(row));
    } catch (err) {
      next(err);
    }
  },
);

collectionsRouter.delete(
  '/requests/:id',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id!);
      const pool = getPool();
      const userId = Number(req.user!.id);

      const result = await pool.query(
        `DELETE FROM requests USING collections c
         WHERE requests.id = $1
           AND requests.collection_id = c.id
           AND c.user_id = $2`,
        [id, userId],
      );
      if (result.rowCount === 0) throw new HttpError(404, 'Zapytanie nie zostało znalezione');
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  },
);
