import type {
  ProxyForwardRequestDto,
  ProxyResponseDto,
} from '@webapi-tester/shared';

const DEFAULT_TIMEOUT_MS = 30_000;

export class AgentForwardError extends Error {
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

// Forward an HTTP request to the target URL and return the response.
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
    body =
      req.bodyEncoding === 'base64'
        ? Buffer.from(req.body, 'base64')
        : req.body;
  }

  const targetUrl =
    req.url.startsWith('/') && req.baseUrl ? req.baseUrl + req.url : req.url;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
      body,
      signal: controller.signal,
    });

    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      bodyBase64: responseBuffer.toString('base64'),
      bodyContentType: response.headers.get('content-type') ?? '',
      durationMs: Math.round(performance.now() - start),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AgentForwardError(
        `Request timed out after ${timeoutMs} ms`,
        504,
      );
    }
    throw new AgentForwardError(
      error instanceof Error ? error.message : 'Unknown error',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
