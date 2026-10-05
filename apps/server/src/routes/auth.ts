import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/jwt.js';
import { HttpError } from '../middleware/error.js';
import type { AuthSuccessDto, UserDto } from '@webapi-tester/shared';

export const authRouter: ReturnType<typeof Router> = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

function toUserDto(row: UserRow): UserDto {
  return {
    id: String(row.id),
    email: row.email,
    createdAt: row.created_at.toString(),
  };
}

function authSuccess(row: UserRow): AuthSuccessDto {
  return {
    user: toUserDto(row),
    accessToken: signAccessToken(String(row.id), row.email),
    refreshToken: signRefreshToken(String(row.id)),
  };
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const pool = getPool();
    const password_hash = await hashPassword(password);

    let row: UserRow;
    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO users (email, password_hash)
           VALUES ($1, $2)
           RETURNING id, email, password_hash, created_at`,
        [email, password_hash],
      );
      const inserted = result.rows[0];
      if (!inserted) throw new HttpError(500, 'Insert returned no row');
      row = inserted;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === '23505'
      ) {
        throw new HttpError(409, 'Email already registered');
      }
      throw err;
    }

    res.status(201).json(authSuccess(row));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const pool = getPool();
    const result = await pool.query<UserRow>(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email],
    );
    const row = result.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      throw new HttpError(401, 'Invalid credentials');
    }
    res.json(authSuccess(row));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const schema = z.object({ refreshToken: z.string() });
    const { refreshToken } = schema.parse(req.body);
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new HttpError(401, 'Invalid refresh token');
    }
    const pool = getPool();
    const result = await pool.query<UserRow>(
      'SELECT id, email, password_hash, created_at FROM users WHERE id = $1',
      [Number(decoded.sub)],
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(401, 'User not found');
    res.json(authSuccess(row));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', async (req, res) => {
  // Stateless: klient usuwa tokeny. Endpoint istnieje dla kompatybilności z WF1.
  res.sendStatus(204);
});
