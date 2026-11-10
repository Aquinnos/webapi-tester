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
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
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

// Zarządzanie kontem (obsługiwane przez nagłówek aplikacji zgodnie z rozdziałem 3
// pracy inżynierskiej): zmiana hasła oraz trwałe usunięcie konta.
describe('account management', () => {
  const app = buildApp();
  const pool = getPool();

  beforeAll(async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = await readFile(resolve(here, '../db/schema.sql'), 'utf-8');
    await pool.query(schema);
    await pool.query(`DELETE FROM users WHERE email LIKE 'acc-%@example.com'`);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE email LIKE 'acc-%@example.com'`);
  });

  async function createUser(email: string, password: string): Promise<number> {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      [email, await hashPassword(password)],
    );
    return result.rows[0]!.id;
  }

  async function login(email: string, password: string) {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password });
    expect(res.status).toBe(200);
    return res.body as { accessToken: string; refreshToken: string };
  }

  it('requires auth to change the password', async () => {
    await createUser('acc-auth@example.com', 'password123');
    const res = await request(app)
      .post('/auth/change-password')
      .send({ currentPassword: 'password123', newPassword: 'nowhaslo456' });
    expect(res.status).toBe(401);
  });

  it('rejects a wrong current password', async () => {
    await createUser('acc-wrongold@example.com', 'password123');
    const session = await login('acc-wrongold@example.com', 'password123');

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ currentPassword: 'zlehaslo', newPassword: 'nowhaslo456' });

    expect(res.status).toBe(401);
    const stillOld = await login('acc-wrongold@example.com', 'password123');
    expect(stillOld.accessToken).toBeTruthy();
  });

  it('enforces the 8-char minimum on the new password', async () => {
    await createUser('acc-shortnew@example.com', 'password123');
    const session = await login('acc-shortnew@example.com', 'password123');

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ currentPassword: 'password123', newPassword: 'krotka' });

    expect(res.status).toBe(400);
  });

  it('changes the password so that only the new one logs in', async () => {
    await createUser('acc-change@example.com', 'password123');
    const session = await login('acc-change@example.com', 'password123');

    const change = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ currentPassword: 'password123', newPassword: 'nowhaslo456' });
    expect(change.status).toBe(200);

    const oldPassword = await request(app)
      .post('/auth/login')
      .send({ email: 'acc-change@example.com', password: 'password123' });
    expect(oldPassword.status).toBe(401);

    const newPassword = await request(app)
      .post('/auth/login')
      .send({ email: 'acc-change@example.com', password: 'nowhaslo456' });
    expect(newPassword.status).toBe(200);
  });

  it('invalidates refresh tokens issued to other sessions', async () => {
    await createUser('acc-othersession@example.com', 'password123');
    const otherSession = await login('acc-othersession@example.com', 'password123');
    const currentSession = await login('acc-othersession@example.com', 'password123');

    const change = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${currentSession.accessToken}`)
      .send({ currentPassword: 'password123', newPassword: 'nowhaslo456' });
    expect(change.status).toBe(200);

    const stale = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: otherSession.refreshToken });
    expect(stale.status).toBe(401);
  });

  it('keeps the current session alive by issuing a fresh token pair', async () => {
    await createUser('acc-keepalive@example.com', 'password123');
    const session = await login('acc-keepalive@example.com', 'password123');

    const change = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ currentPassword: 'password123', newPassword: 'nowhaslo456' });
    expect(change.status).toBe(200);
    expect(change.body.accessToken).toBeTruthy();
    expect(change.body.refreshToken).toBeTruthy();

    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: change.body.refreshToken });
    expect(refreshed.status).toBe(200);
  });

  it('requires auth to delete the account', async () => {
    await createUser('acc-delauth@example.com', 'password123');
    const res = await request(app)
      .delete('/auth/me')
      .send({ password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('rejects a wrong password when deleting the account', async () => {
    await createUser('acc-delwrongpw@example.com', 'password123');
    const session = await login('acc-delwrongpw@example.com', 'password123');

    const res = await request(app)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ password: 'zlehaslo' });
    expect(res.status).toBe(401);

    const stillThere = await login('acc-delwrongpw@example.com', 'password123');
    expect(stillThere.accessToken).toBeTruthy();
  });

  it('deletes the account together with its collections and history', async () => {
    const userId = await createUser('acc-delete@example.com', 'password123');
    const collection = await pool.query<{ id: number }>(
      `INSERT INTO collections (user_id, name) VALUES ($1, 'do usuniecia')
       RETURNING id`,
      [userId],
    );
    await pool.query(
      `INSERT INTO requests (collection_id, name, method, url)
       VALUES ($1, 'zapytanie', 'GET', 'https://example.com')`,
      [collection.rows[0]!.id],
    );
    await pool.query(
      `INSERT INTO request_history (user_id, method, url, status_code, response_time_ms)
       VALUES ($1, 'GET', 'https://example.com', 200, 12)`,
      [userId],
    );

    const session = await login('acc-delete@example.com', 'password123');
    const res = await request(app)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ password: 'password123' });
    expect(res.status).toBe(204);

    const counts = await pool.query<{ count: string }>(
      `SELECT
         (SELECT count(*) FROM users WHERE id = $1) AS users,
         (SELECT count(*) FROM collections WHERE user_id = $1) AS collections,
         (SELECT count(*) FROM request_history WHERE user_id = $1) AS history,
         (SELECT count(*) FROM requests r
            JOIN collections c ON c.id = r.collection_id
           WHERE c.user_id = $1) AS requests`,
      [userId],
    );
    const row = counts.rows[0]!;
    expect(row.users).toBe('0');
    expect(row.collections).toBe('0');
    expect(row.history).toBe('0');
    expect(row.requests).toBe('0');
  });

  it('rejects a protected request once the account is gone', async () => {
    const userId = await createUser('acc-gone@example.com', 'password123');
    const session = await login('acc-gone@example.com', 'password123');
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    const res = await request(app)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ password: 'password123' });
    expect(res.status).toBe(401);
  });
});

// Pula jest wspólna dla całego pliku, więc zamykana jest dopiero po obu blokach.
// Wcześniejsze zamknięcie w afterAll pierwszego bloku unieruchamiało pulę dla drugiego.
afterAll(async () => {
  await closePool();
});
