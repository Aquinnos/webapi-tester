import type {
  CollectionDto,
  CollectionWithRequestsDto,
  RequestDto,
  CreateCollectionDto,
  UpdateCollectionDto,
  CreateRequestDto,
  UpdateRequestDto,
  HistoryEntryDto,
} from '@webapi-tester/shared';

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

export const collectionsApi = {
  list: (token: string) =>
    api<CollectionDto[]>('/collections', { accessToken: token }),
  get: (token: string, id: string) =>
    api<CollectionWithRequestsDto>(`/collections/${id}`, {
      accessToken: token,
    }),
  create: (token: string, dto: CreateCollectionDto) =>
    api<CollectionDto>('/collections', {
      method: 'POST',
      accessToken: token,
      body: dto,
    }),
  update: (token: string, id: string, dto: UpdateCollectionDto) =>
    api<CollectionDto>(`/collections/${id}`, {
      method: 'PATCH',
      accessToken: token,
      body: dto,
    }),
  remove: (token: string, id: string) =>
    api<void>(`/collections/${id}`, { method: 'DELETE', accessToken: token }),
  addRequest: (token: string, collectionId: string, dto: CreateRequestDto) =>
    api<RequestDto>(`/collections/${collectionId}/requests`, {
      method: 'POST',
      accessToken: token,
      body: dto,
    }),
  updateRequest: (token: string, id: string, dto: UpdateRequestDto) =>
    api<RequestDto>(`/requests/${id}`, {
      method: 'PATCH',
      accessToken: token,
      body: dto,
    }),
  removeRequest: (token: string, id: string) =>
    api<void>(`/requests/${id}`, { method: 'DELETE', accessToken: token }),
};

export const historyApi = { 
  list: (token: string) => 
    api<{ entries: HistoryEntryDto[] }>('/history', { accessToken: token }), 
  remove: (token: string, id: string) =>
    api<void>(`/history/${id}`, { method: 'DELETE', accessToken: token }),
  clear: (token: string) =>
    api<void>('/history', { method: 'DELETE', accessToken: token }),
};

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
