import type { RequestHandler } from 'express';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Key',
  'Access-Control-Max-Age': '600',
};

export const corsMiddleware: RequestHandler = (_req, res, next) => {
  res.set(CORS_HEADERS);
  next();
};
