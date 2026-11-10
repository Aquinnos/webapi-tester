import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorDto } from '@webapi-tester/shared';
import { formatZodError } from '../lib/zod-errors-pl.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly details?: string,
  ) {
    super(details ?? `HTTP ${status}`);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiErrorDto>,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Błąd walidacji',
      details: formatZodError(err),
    });
    return;
  }

  if (err instanceof HttpError) {
    // HttpError kopiuje details do message, więc bez tego warunku klient
    // dostawałby tę samą treść w polu error i w polu details.
    const body: ApiErrorDto = { error: err.message };
    if (err.details && err.details !== err.message) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Błąd serwera' });
}
