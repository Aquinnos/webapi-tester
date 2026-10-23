import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRouter } from './auth.js';
import { errorHandler } from '../middleware/error.js';
import { getPool, closePool } from '../db/pool.js';
import { hashPassword } from '../services/password.js';
import { config } from '../config.js';
import jwt from 'jsonwebtoken';
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

  it('logout requires auth', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });
    const { accessToken, refreshToken } = login.body;

    const logout = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logout.status).toBe(204);

    const refresh = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('rotates refresh tokens and invalidates the previous one', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });
    const first = login.body.refreshToken;

    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: first });
    expect(refreshed.status).toBe(200);
    const second = refreshed.body.refreshToken;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);

    const reuse = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: first });
    expect(reuse.status).toBe(401);

    const secondUse = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: second });
    expect(secondUse.status).toBe(200);
  });

  it('rejects a correctly signed refresh token that was never issued', async () => {
    const user = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE email = 'alice@example.com'`,
    );
    const forged = jwt.sign(
      { sub: String(user.rows[0]!.id), type: 'refresh' },
      config.JWT_SECRET_KEY,
      { algorithm: 'HS256', expiresIn: '7d' },
    );

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: forged });
    expect(res.status).toBe(401);
  });

  it('does not allow logout to revoke another user token', async () => {
    const alice = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });
    await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ('carol@example.com', $1)`,
      [await hashPassword('password123')],
    );
    const bobLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'carol@example.com', password: 'password123' });
    expect(bobLogin.status).toBe(200);

    const logout = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${bobLogin.body.accessToken}`)
      .send({ refreshToken: alice.body.refreshToken });
    expect(logout.status).toBe(204);

    const stillWorks = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: alice.body.refreshToken });
    expect(stillWorks.status).toBe(200);
  });
});
