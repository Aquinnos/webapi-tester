import type {
  ProxyForwardRequestDto,
  ProxyResponseDto,
} from '@webapi-tester/shared';
import { ForwardError } from './forward-error.js';
import type { AgentSettings } from './agent-settings.js';

interface LoopbackRequestInit extends RequestInit {
  targetAddressSpace?: 'loopback';
}

export interface AgentStatus {
  reachable: boolean;
  authorized: boolean;
}

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

export const AGENT_RUN_COMMAND =
  'docker run --rm -p 127.0.0.1:3002:3002 ghcr.io/aquinnos/webapi-tester-agent:latest';

function agentUrl(settings: AgentSettings, path: string): string {
  return `${settings.url.replace(/\/+$/, '')}${path}`;
}

function isLoopback(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Chrome od wersji 142 wymaga zgody na dostep do sieci lokalnej, gdy aplikacja
// jest wystawiona w internecie. Pole targetAddressSpace uruchamia prompt zgody.
function loopbackInit(init: RequestInit, url: string): LoopbackRequestInit {
  return isLoopback(url) ? { ...init, targetAddressSpace: 'loopback' } : init;
}

export async function probeAgent(
  settings: AgentSettings,
): Promise<AgentStatus> {
  if (!settings.url) {
    return { reachable: false, authorized: false };
  }

  try {
    const url = agentUrl(settings, '/health');
    const health = await fetch(
      url,
      loopbackInit({ headers: { Accept: 'application/json' } }, url),
    );
    if (!health.ok) {
      return { reachable: false, authorized: false };
    }
  } catch {
    return { reachable: false, authorized: false };
  }

  if (!settings.key) {
    return { reachable: true, authorized: false };
  }

  try {
    const url = agentUrl(settings, '/session');
    const session = await fetch(
      url,
      loopbackInit({ headers: { 'X-Proxy-Key': settings.key } }, url),
    );
    return { reachable: true, authorized: session.ok };
  } catch {
    return { reachable: false, authorized: false };
  }
}

export async function agentForward(
  dto: ProxyForwardRequestDto,
  settings: AgentSettings,
): Promise<ProxyResponseDto> {
  if (!settings.key) {
    throw new ForwardError(
      'Brak klucza agenta proxy.',
      'config',
      undefined,
      undefined,
      'Otworz panel agenta i wklej klucz wypisany w logu startowym agenta.',
    );
  }

  const url = agentUrl(settings, '/forward');
  let res: Response;
  try {
    res = await fetch(
      url,
      loopbackInit(
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Proxy-Key': settings.key,
          },
          body: JSON.stringify(dto),
        },
        url,
      ),
    );
  } catch {
    throw new ForwardError(
      'Agent proxy nie odpowiada.',
      'network',
      undefined,
      undefined,
      `Uruchom agenta komenda: ${AGENT_RUN_COMMAND}`,
    );
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: res.statusText, details: undefined }));
    const error = new ForwardError(
      body.error ?? `Agent proxy zwrócił błąd ${res.status}`,
      res.status === 401 ? 'config' : 'agent',
      res.status,
      body.details,
      res.status === 401
        ? 'Klucz agenta nie zgadza się z kluczem w logu agenta.'
        : undefined,
    );
    throw error;
  }

  return (await res.json()) as ProxyResponseDto;
}
