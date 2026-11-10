import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/jwt.js';
import { HttpError } from './error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

// Middleware to require authentication for a route. If the request does not have a valid access token, it will throw an HttpError with status 401.
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Brak nagłówka Authorization lub jest nieprawidłowy');
  }
  const token = header.substring('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    throw new HttpError(401, 'Nieprawidłowy token dostępu');
  }
}
