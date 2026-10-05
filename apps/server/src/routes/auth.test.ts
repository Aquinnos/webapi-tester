import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRouter } from './auth.js';
import { errorHandler } from '../middleware/error.js';
import { getPool, closePool } from '../db/pool.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use(errorHandler);
  return app;
}

describe('auth routes', () => {
  const app = buildApp();
  const pool = getPool();

  beforeAll(async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = await readFile(resolve(here, '../db/schema.sql'), 'utf-8');
    await pool.query(schema);
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await closePool();
  });

  it('registers a new user and returns tokens', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });
  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('logs in existing user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('validates email format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('enforces 8-char password minimum', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('refreshes tokens', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });
    const refresh = login.body.refreshToken;
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: refresh });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('rejects garbage refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-jwt' });
    expect(res.status).toBe(401);
  });

  it('logout returns 204', async () => {
    const res = await request(app).post('/auth/logout').send();
    expect(res.status).toBe(204);
  });
});
