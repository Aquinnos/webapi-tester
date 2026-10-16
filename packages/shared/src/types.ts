// Współdzielone typy DTO używane przez apps/web, apps/server i apps/proxy.
// Definicje odpowiadają wymaganiom WF1-WF7 z rozdziału 3 pracy inżynierskiej.

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

// ============ Autentykacja (WF1) ============

export interface UserDto {
  id: string;
  email: string;
  createdAt: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthSuccessDto {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequestDto {
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

// ============ Proxy (WF2 + WF3 + WF7) ============

export type BodyEncoding = 'utf-8' | 'base64';

export interface ProxyForwardRequestDto {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
  bodyEncoding: BodyEncoding;
}

export interface ProxyResponseDto {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyBase64: string;
  bodyContentType: string;
  durationMs: number;
}

// ============ Kolekcje (WF5) ============

export interface CollectionDto {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface RequestDto {
  id: string;
  collectionId: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface CreateCollectionDto {
  name: string;
}

export interface UpdateCollectionDto {
  name?: string;
}

export interface CreateRequestDto {
  name: string;
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface UpdateRequestDto {
  name?: string;
  method?: HttpMethod;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}

// ============ Historia (WF6) ============

export interface HistoryEntryDto {
  id: string;
  userId: string;
  requestId: string | null;
  method: HttpMethod;
  url: string;
  status: number;
  durationMs: number;
  body: string;
  timestamp: string;
}

// ============ OpenAPI (WF4) ============

export interface OpenApiImportUrlDto {
  url: string;
}

export interface OpenApiImportFileDto {
  fileContent: string;
}

export type OpenApiImportDto = OpenApiImportUrlDto | OpenApiImportFileDto;

export interface GeneratedRequestDto {
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
  bodyEncoding: BodyEncoding;
  description: string;
}

export interface OpenApiImportSuccessDto {
  title: string;
  version: string;
  requests: GeneratedRequestDto[];
}

export interface OpenApiImportErrorDto {
  error: string;
  details: string;
}

export type OpenApiImportResultDto =
  | OpenApiImportSuccessDto
  | OpenApiImportErrorDto;

// ============ Błędy generyczne ============

export interface ApiErrorDto {
  error: string;
  details?: string;
}

export interface CollectionWithRequestsDto extends CollectionDto {
  requests: RequestDto[];
}
