import type {
  ProxyForwardRequestDto,
  ProxyResponseDto,
} from '@webapi-tester/shared';
import { ForwardError } from './forward-error.js';
import { decodeBase64ToBytes, encodeBytesToBase64 } from './body.js';

const ABSOLUTE_URL = /^https?:\/\//i;

function resolveUrl(dto: ProxyForwardRequestDto): string {
  if (ABSOLUTE_URL.test(dto.url)) {
    return dto.url;
  }
  if (dto.baseUrl) {
    return new URL(dto.url, dto.baseUrl).toString();
  }
  throw new ForwardError(
    'Adres żądania musi być bezwzględny.',
    'config',
    undefined,
    undefined,
    'Podaj pełny adres z protokołem http lub https.',
  );
}

function buildBody(dto: ProxyForwardRequestDto): BodyInit | undefined {
  if (dto.method === 'GET' || dto.method === 'HEAD') {
    return undefined;
  }
  if (dto.bodyEncoding === 'base64') {
    const bytes = decodeBase64ToBytes(dto.body);
    const buffer = new Uint8Array(bytes.byteLength);
    buffer.set(bytes);
    return buffer.buffer;
  }
  return dto.body;
}

export async function directForward(
  dto: ProxyForwardRequestDto,
): Promise<ProxyResponseDto> {
  const url = resolveUrl(dto);
  const startedAt = performance.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: dto.method,
      headers: dto.headers,
      body: buildBody(dto),
    });
  } catch {
    throw new ForwardError(
      'Przeglądarka zablokowała żądanie do serwera docelowego.',
      'cors',
      undefined,
      undefined,
      'Najczęstszą przyczyną są brak nagłówków CORS po stronie serwera docelowego albo mieszana zawartość (https do http). Uruchom lokalnego agenta proxy.',
    );
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const buffer = await res.arrayBuffer();
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    status: res.status,
    statusText: res.statusText,
    headers,
    bodyBase64: encodeBytesToBase64(new Uint8Array(buffer)),
    bodyContentType: res.headers.get('content-type') ?? '',
    durationMs,
  };
}
