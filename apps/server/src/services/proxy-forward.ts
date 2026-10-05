import type {
  ProxyForwardRequestDto,
  ProxyResponseDto,
  BodyEncoding,
} from '@webapi-tester/shared';

const DEFAULT_TIMEOUT_MS = 30_000;

export class ProxyForwardError extends Error {
  constructor(
    message: string,
    public readonly status: number = 502,
  ) {
    super(message);
  }
}

interface ForwardOptions {
  timeoutMs?: number;
}

export async function forwardRequest(
  req: ProxyForwardRequestDto,
  options: ForwardOptions = {},
): Promise<ProxyResponseDto> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const start = performance.now();

  let body: string | Buffer | undefined;
  if (req.body) {
    if (req.bodyEncoding === 'base64') {
      body = Buffer.from(req.body, 'base64');
    } else {
      body = req.body;
    }
  }

  try {
    const response = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body,
      signal: controller.signal,
    });

    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const bodyContentType = response.headers.get('content-type') ?? '';

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      bodyBase64: responseBuffer.toString('base64'),
      bodyContentType,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProxyForwardError(
        `Request timed out after ${timeoutMs} ms`,
        504,
      );
    }
    throw new ProxyForwardError(
      error instanceof Error ? error.message : 'Unknown error',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
