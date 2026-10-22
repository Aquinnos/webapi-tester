import type {
  ProxyForwardRequestDto,
  ProxyResponseDto,
} from '@webapi-tester/shared';

const AGENT_URL = import.meta.env.VITE_PROXY_URL ?? 'http://127.0.0.1:3002';
const AGENT_KEY = import.meta.env.VITE_PROXY_SHARED_SECRET ?? '';

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string,
  ) {
    super(message);
  }
}

export async function agentForward(
  dto: ProxyForwardRequestDto,
): Promise<ProxyResponseDto> {
  if (!AGENT_KEY) {
    throw new AgentError(
      'Brak klucza agenta proxy. Uzupełnij VITE_PROXY_SHARED_SECRET w pliku .env i uruchom ponownie aplikację webową.',
      0,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${AGENT_URL}/forward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Key': AGENT_KEY,
      },
      body: JSON.stringify(dto),
    });
  } catch {
    throw new AgentError(
      'Agent proxy nie odpowiada. Uruchom go komendą: pnpm --filter @webapi-tester/proxy dev',
      0,
    );
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: res.statusText, details: undefined }));
    throw new AgentError(
      body.error ?? `Agent proxy zwrocil blad ${res.status}`,
      res.status,
      body.details,
    );
  }

  return (await res.json()) as ProxyResponseDto;
}
