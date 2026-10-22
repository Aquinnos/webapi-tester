import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { historyRouter } from './history.js';
import { errorHandler } from '../middleware/error.js';
import { getPool, closePool } from '../db/pool.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

let app: express.Express;
let aliceToken: string;
let bobToken: string;
let aliceId: number;


beforeAll(async () => {
  const here = dirname(fileURLToPath(import.meta.url)); 
  const schema = await readFile(resolve(here, '../db/schema.sql'), 'utf-8');
  const pool = getPool(); 
  await pool.query(schema);
  await pool.query('TRUNCATE users, request_history RESTART IDENTITY CASCADE');

  const alice = await pool.query<{ id: number }>(
    `INSERT INTO users (email, password_hash) VALUES ('alice@test.com', 'x') RETURNING id`,
  );
  aliceId = alice.rows[0]!.id;
  const bob = await pool.query<{ id: number }>(
    `INSERT INTO users (email, password_hash) VALUES ('bob@test.com', 'x') RETURNING id`,
  );
  const bobId = bob.rows[0]!.id;

  aliceToken = jwt.sign(
    { sub: String(aliceId), email: 'alice@test.com', type: 'access' },
    config.JWT_SECRET_KEY,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
  bobToken = jwt.sign(
    { sub: String(bobId), email: 'bob@test.com', type: 'access' },
    config.JWT_SECRET_KEY,
    { algorithm: 'HS256', expiresIn: '15m' },
  );

  app = express();
  app.use(express.json());
  app.use(historyRouter);
  app.use(errorHandler);
});

// Reset the request_history table before each test
beforeEach(async () => {
    await getPool().query('TRUNCATE request_history RESTART IDENTITY CASCADE');
  });

afterAll(async () => {
  await closePool();
});

async function seedHistory( 
  userId: number,
  url: string,
  executedAt: Date,
  status: number = 200,
): Promise<number> {
  const result = await getPool().query<{ id: number }>(
    `INSERT INTO request_history (user_id, request_id, method, url, status_code, response_time_ms, response_body, executed_at)
       VALUES ($1, NULL, 'GET', $2, $3, 100, '', $4)
       RETURNING id`,
    [userId, url, status, executedAt],
  );
  return result.rows[0]!.id;
}

describe('GET /history', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/history');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no history', async () => {
    const res = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]); 
  });

  it('returns history ordered newest first', async () => {
    const older = await seedHistory(
      aliceId,
      'http://old.com',
      new Date('2026-01-01T10:00:00Z'),
    );
    const newer = await seedHistory(
      aliceId,
      'http://new.com',
      new Date('2026-01-02T10:00:00Z'),
    );

    const res = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries[0].id).toBe(String(newer));
    expect(res.body.entries[1].id).toBe(String(older));
  });

  it('does not return other user history', async () => {
    await seedHistory(aliceId, 'http://a.com', new Date());

    const bob = await getPool().query<{ id: number }>(
      `SELECT id FROM users WHERE email = 'bob@test.com'`,
    );
    await seedHistory(bob.rows[0]!.id, 'http://bob.com', new Date());

    const res = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].url).toBe('http://a.com');
  });

  it('includes expected fields', async () => {
    await seedHistory(aliceId, 'http://example.com', new Date(), 404);

    const res = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${aliceToken}`);
    const entry = res.body.entries[0];
    expect(entry).toMatchObject({
      method: 'GET',
      url: 'http://example.com',
      status: 404,
      durationMs: 100,
    });
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
  });
});

describe('POST /history', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/history').send({
      method: 'GET',
      url: 'https://example.com',
      status: 200,
      durationMs: 120,
      body: 'ok',
    });
    expect(res.status).toBe(401);
  });

  it('records an entry and returns id and executedAt', async () => {
    const res = await request(app)
      .post('/history')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        method: 'POST',
        url: 'https://example.com/api/items',
        status: 201,
        durationMs: 143,
        body: '{"ok":true}',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.executedAt).toBeTruthy();
  });

  it('makes the recorded entry visible in GET /history', async () => {
    await request(app)
      .post('/history')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        method: 'PUT',
        url: 'https://example.com/api/items/7',
        status: 204,
        durationMs: 55,
        body: '',
      });

    const res = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0]).toMatchObject({
      method: 'PUT',
      url: 'https://example.com/api/items/7',
      status: 204,
      durationMs: 55,
      body: '',
    });
  });

  it('truncates response body to 50000 characters', async () => {
    const long = 'x'.repeat(60_000);
    await request(app)
      .post('/history')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        method: 'GET',
        url: 'https://example.com/big',
        status: 200,
        durationMs: 900,
        body: long,
      });

    const res = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.body.entries[0].body).toHaveLength(50_000);
  });

  it('rejects an unsupported method with 400', async () => {
    const res = await request(app)
      .post('/history')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        method: 'TRACE',
        url: 'https://example.com',
        status: 200,
        durationMs: 10,
        body: '',
      });
    expect(res.status).toBe(400);
  });

  it('rejects a non-numeric status with 400', async () => {
    const res = await request(app)
      .post('/history')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        method: 'GET',
        url: 'https://example.com',
        status: 'OK',
        durationMs: 10,
        body: '',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an empty url with 400', async () => {
    const res = await request(app)
      .post('/history')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ method: 'GET', url: '', status: 200, durationMs: 10, body: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /history/:id', () => {
  it('deletes a single entry', async () => {
    const id = await seedHistory(aliceId, 'http://a.com', new Date());
    const del = await request(app)
      .delete(`/history/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(get.body.entries).toEqual([]);
  });

  it('returns 404 for other user entry', async () => {
    const bob = await getPool().query<{ id: number }>(
      `SELECT id FROM users WHERE email = 'bob@test.com'`,
    );
    const id = await seedHistory(bob.rows[0]!.id, 'http://b.com', new Date());
    const res = await request(app)
      .delete(`/history/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /history', () => {
  it('clears all user history', async () => {
    await seedHistory(aliceId, 'http://a.com', new Date());
    await seedHistory(aliceId, 'http://b.com', new Date());
    const bob = await getPool().query<{ id: number }>(
      `SELECT id FROM users WHERE email = 'bob@test.com'`,
    );
    await seedHistory(bob.rows[0]!.id, 'http://c.com', new Date());

    const del = await request(app)
      .delete('/history')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(del.status).toBe(204);

    const aliceHistory = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceHistory.body.entries).toEqual([]);

    const bobHistory = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobHistory.body.entries).toHaveLength(1);
  });
});
