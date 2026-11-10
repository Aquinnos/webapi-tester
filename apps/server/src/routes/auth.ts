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
import { requireAuth } from '../middleware/auth.js';
import {
  isRefreshTokenActive,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  storeRefreshToken,
} from '../services/refresh-token-store.js';
import type { AuthSuccessDto, UserDto } from '@webapi-tester/shared';

export const authRouter: ReturnType<typeof Router> = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({ refreshToken: z.string() });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
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

async function issueSession(row: UserRow): Promise<AuthSuccessDto> {
  const refreshToken = signRefreshToken(String(row.id));
  await storeRefreshToken(row.id, refreshToken);
  return {
    user: toUserDto(row),
    accessToken: signAccessToken(String(row.id), row.email),
    refreshToken,
  };
}

async function findUserById(id: number): Promise<UserRow> {
  const result = await getPool().query<UserRow>(
    'SELECT id, email, password_hash, created_at FROM users WHERE id = $1',
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(401, 'Użytkownik nie został znaleziony');
  return row;
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
      if (!inserted) throw new HttpError(500, 'Wstawienie nie zwróciło wiersza');
      row = inserted;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === '23505'
      ) {
        throw new HttpError(409, 'E-mail jest już zarejestrowany');
      }
      throw err;
    }

    res.status(201).json(await issueSession(row));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const result = await getPool().query<UserRow>(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email],
    );
    const row = result.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      throw new HttpError(401, 'Nieprawidłowy e-mail lub hasło');
    }
    res.json(await issueSession(row));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new HttpError(401, 'Nieprawidłowy token odnowienia');
    }
    const userId = Number(decoded.sub);
    if (!(await isRefreshTokenActive(userId, refreshToken))) {
      throw new HttpError(401, 'Token odnowienia został unieważniony lub wygasł');
    }
    await revokeRefreshToken(userId, refreshToken);
    const row = await findUserById(userId);
    res.json(await issueSession(row));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await revokeRefreshToken(Number(req.user!.id), refreshToken);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

// Zmiana hasła odcina pozostałe sesje: tokeny odnowienia zapisane w innych
// przeglądarkach przestają działać, a bieżąca sesja otrzymuje świeżą parę.
authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = Number(req.user!.id);
    const row = await findUserById(userId);

    if (!(await verifyPassword(currentPassword, row.password_hash))) {
      throw new HttpError(401, 'Obecne hasło jest nieprawidłowe');
    }

    await getPool().query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      await hashPassword(newPassword),
      userId,
    ]);
    await revokeAllRefreshTokens(userId);

    res.json(await issueSession(row));
  } catch (e) {
    next(e);
  }
});

authRouter.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const { password } = deleteAccountSchema.parse(req.body);
    const userId = Number(req.user!.id);
    const row = await findUserById(userId);

    if (!(await verifyPassword(password, row.password_hash))) {
      throw new HttpError(401, 'Hasło jest nieprawidłowe');
    }

    await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});