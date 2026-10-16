import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { collectionsRouter } from './collections.js';
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
  await pool.query(
    'TRUNCATE users, collections, requests, request_history RESTART IDENTITY CASCADE',
  );

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
  app.use(collectionsRouter);
  app.use(errorHandler);
});

afterAll(async () => {
  await closePool();
});

async function createCollection(
  name: string,
  token: string,
): Promise<{ id: string }> {
  const res = await request(app)
    .post('/collections')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  expect(res.status).toBe(201);
  return res.body;
}

describe('GET /collections', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/collections');
    expect(res.status).toBe(401);
  });

  it('returns empty array for user with no collections', async () => {
    const res = await request(app)
      .get('/collections')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /collections', () => {
  it('creates a collection', async () => {
    const res = await request(app)
      .post('/collections')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'My API' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My API');
    expect(res.body.id).toBeTruthy();
    expect(res.body.createdAt).toBeTruthy();
    expect(res.body.userId).toBe(String(aliceId));
  });

  it('validates empty name', async () => {
    const res = await request(app)
      .post('/collections')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });
});

describe('GET /collections/:id', () => {
  it('returns collection with requests', async () => {
    const { id } = await createCollection('Test', aliceToken);
    const res = await request(app)
      .get(`/collections/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.requests).toEqual([]);
  });

  it('returns 404 for non-existent', async () => {
    const res = await request(app)
      .get('/collections/99999')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for other user collection', async () => {
    const { id } = await createCollection('Alice', aliceToken);
    const res = await request(app)
      .get(`/collections/${id}`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /collections/:id', () => {
  it('renames a collection', async () => {
    const { id } = await createCollection('Old', aliceToken);
    const res = await request(app)
      .patch(`/collections/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New');
  });

  it('returns 404 when other user tries to rename', async () => {
    const { id } = await createCollection('Original', aliceToken);
    const res = await request(app)
      .patch(`/collections/${id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /collections/:id', () => {
  it('deletes a collection', async () => {
    const { id } = await createCollection('To delete', aliceToken);
    const del = await request(app)
      .delete(`/collections/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/collections/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(get.status).toBe(404);
  });

  it('cascades delete to requests', async () => {
    const { id } = await createCollection('With requests', aliceToken);
    await request(app)
      .post(`/collections/${id}/requests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'R1',
        method: 'GET',
        url: 'http://example.com',
        headers: {},
        body: '',
      });
    await request(app)
      .delete(`/collections/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const reqCheck = await getPool().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM requests WHERE collection_id = $1',
      [id],
    );
    expect(Number(reqCheck.rows[0]!.count)).toBe(0);
  });
});

describe('POST /collections/:id/requests', () => {
  it('adds request to collection', async () => {
    const { id } = await createCollection('Test', aliceToken);
    const res = await request(app)
      .post(`/collections/${id}/requests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Get example',
        method: 'GET',
        url: 'http://example.com',
        headers: { 'X-Custom': 'value' },
        body: '',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Get example');
    expect(res.body.collectionId).toBe(id);
    expect(res.body.method).toBe('GET');
    expect(res.body.headers).toEqual({ 'X-Custom': 'value' });
  });

  it('validates URL', async () => {
    const { id } = await createCollection('Test', aliceToken);
    const res = await request(app)
      .post(`/collections/${id}/requests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Bad',
        method: 'GET',
        url: 'not-a-url',
        headers: {},
        body: '',
      });
    expect(res.status).toBe(400);
  });

  it('returns 404 for collection of other user', async () => {
    const { id } = await createCollection('Alice', aliceToken);
    const res = await request(app)
      .post(`/collections/${id}/requests`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        name: 'Sneaky',
        method: 'GET',
        url: 'http://example.com',
        headers: {},
        body: '',
      });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /requests/:id', () => {
  it('edits a request', async () => {
    const { id } = await createCollection('Test', aliceToken);
    const add = await request(app)
      .post(`/collections/${id}/requests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Original',
        method: 'GET',
        url: 'http://example.com',
        headers: {},
        body: '',
      });
    const reqId = add.body.id;

    const res = await request(app)
      .patch(`/requests/${reqId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Updated',
        method: 'POST',
        url: 'http://example.com',
        headers: {},
        body: 'hello',
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
    expect(res.body.method).toBe('POST');
    expect(res.body.body).toBe('hello');
  });

  it('returns 404 when editing other user request', async () => {
    const { id } = await createCollection('Alice', aliceToken);
    const add = await request(app)
      .post(`/collections/${id}/requests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Mine',
        method: 'GET',
        url: 'http://example.com',
        headers: {},
        body: '',
      });
    const reqId = add.body.id;

    const res = await request(app)
      .patch(`/requests/${reqId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        name: 'Hijacked',
        method: 'POST',
        url: 'http://example.com',
        headers: {},
        body: '',
      });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /requests/:id', () => {
  it('deletes a request', async () => {
    const { id } = await createCollection('Test', aliceToken);
    const add = await request(app)
      .post(`/collections/${id}/requests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'To delete',
        method: 'GET',
        url: 'http://example.com',
        headers: {},
        body: '',
      });
    const res = await request(app)
      .delete(`/requests/${add.body.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 when other user tries to delete', async () => {
    const { id } = await createCollection('Alice', aliceToken);
    const add = await request(app)
      .post(`/collections/${id}/requests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Mine',
        method: 'GET',
        url: 'http://example.com',
        headers: {},
        body: '',
      });
    const res = await request(app)
      .delete(`/requests/${add.body.id}`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(404);
  });
});
