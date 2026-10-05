import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorDto } from '@webapi-tester/shared';

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
      error: 'ValidationError',
      details: err.issues
        .map((issue) => `${issue.path.join('.')} ${issue.message}`)
        .join('; '),
    });
    return;
  }

  if (err instanceof HttpError) {
    const body: ApiErrorDto = { error: err.message };
    if (err.details) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'InternalServerError' });
}
