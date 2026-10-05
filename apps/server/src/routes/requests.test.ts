import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { requestsRouter } from './requests.js';
import { errorHandler } from '../middleware/error.js';
import { getPool, closePool } from '../db/pool.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

let app: express.Express;
let accessToken: string;
let userId: number;
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const schema = await readFile(resolve(here, '../db/schema.sql'), 'utf-8');
  const pool = getPool();
  await pool.query(schema);
  await pool.query('TRUNCATE users, request_history RESTART IDENTITY CASCADE');
  const inserted = await pool.query<{ id: number }>(
    `INSERT INTO users (email, password_hash) VALUES ('r@test.com', 'x') RETURNING id`,
  );
  userId = inserted.rows[0]!.id;
  accessToken = jwt.sign(
    { sub: String(userId), email: 'r@test.com', type: 'access' },
    config.JWT_SECRET_KEY,
    { algorithm: 'HS256', expiresIn: '15m' },
  );

  const mockHeaders = new Headers();
  mockHeaders.set('Content-Type', 'application/json');
  const mockArrayBuffer = new TextEncoder().encode('{"ok":true}').buffer;
  fetchMock = vi.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: mockHeaders,
    arrayBuffer: async () => mockArrayBuffer,
  });
  vi.stubGlobal('fetch', fetchMock);

  app = express();
  app.use(express.json());
  app.use(requestsRouter);
  app.use(errorHandler);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await closePool();
});

describe('POST /proxy/forward', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/proxy/forward').send({
      method: 'GET',
      url: 'http://example.com',
      headers: {},
      body: '',
      bodyEncoding: 'utf-8',
    });
    expect(res.status).toBe(401);
  });

  it('validates URL', async () => {
    const res = await request(app)
      .post('/proxy/forward')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        method: 'GET',
        url: 'not-a-url',
        headers: {},
        body: '',
        bodyEncoding: 'utf-8',
      });
    expect(res.status).toBe(400);
  });

  it('validates HTTP method', async () => {
    const res = await request(app)
      .post('/proxy/forward')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        method: 'INVALID',
        url: 'http://example.com',
        headers: {},
        body: '',
        bodyEncoding: 'utf-8',
      });
    expect(res.status).toBe(400);
  });

  it('forwards and returns ProxyResponseDto', async () => {
    const res = await request(app)
      .post('/proxy/forward')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        method: 'GET',
        url: 'http://example.com',
        headers: {},
        body: '',
        bodyEncoding: 'utf-8',
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(200);
    expect(res.body.statusText).toBe('OK');
    expect(res.body.bodyBase64).toBeTruthy();
    expect(res.body.bodyContentType).toContain('application/json');
    expect(res.body.durationMs).toBeGreaterThanOrEqual(0);
    const decoded = Buffer.from(res.body.bodyBase64, 'base64').toString(
      'utf-8',
    );
    expect(JSON.parse(decoded)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('saves to request_history on success', async () => {
    const before = await getPool().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM request_history WHERE user_id = $1',
      [userId],
    );
    await request(app)
      .post('/proxy/forward')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        method: 'GET',
        url: 'http://example.com',
        headers: {},
        body: '',
        bodyEncoding: 'utf-8',
      });
    const after = await getPool().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM request_history WHERE user_id = $1',
      [userId],
    );
    expect(Number(after.rows[0]!.count)).toBe(
      Number(before.rows[0]!.count) + 1,
    );
  });
});
