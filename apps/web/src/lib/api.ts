import type { ApiErrorDto } from '@webapi-tester/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string;
}

export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.accessToken) { 
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const errBody: ApiErrorDto = await res
      .json()
      .catch(() => ({ error: res.statusText }));
    throw new ApiError(errBody.error, res.status, errBody.details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
