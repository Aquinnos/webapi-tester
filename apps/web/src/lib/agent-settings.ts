export type ForwardMode = 'auto' | 'agent' | 'direct';

export interface AgentSettings {
  url: string;
  key: string;
}

const STORAGE_SETTINGS = 'webapi-tester.agent';
const STORAGE_MODE = 'webapi-tester.forward-mode';

export const DEFAULT_AGENT_URL = 'http://127.0.0.1:3002';

function envValue(name: string): string {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value : '';
}

export function defaultAgentSettings(): AgentSettings {
  return {
    url: envValue('VITE_PROXY_URL') || DEFAULT_AGENT_URL,
    key: envValue('VITE_PROXY_SHARED_SECRET'),
  };
}

export function loadAgentSettings(): AgentSettings {
  const fallback = defaultAgentSettings();
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AgentSettings>;
    return {
      url:
        typeof parsed.url === 'string' && parsed.url.length > 0
          ? parsed.url
          : fallback.url,
      key: typeof parsed.key === 'string' ? parsed.key : fallback.key,
    };
  } catch {
    return fallback;
  }
}

export function saveAgentSettings(settings: AgentSettings): void {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
}

export function loadForwardMode(): ForwardMode {
  const raw = localStorage.getItem(STORAGE_MODE);
  return raw === 'agent' || raw === 'direct' ? raw : 'auto';
}

export function saveForwardMode(mode: ForwardMode): void {
  localStorage.setItem(STORAGE_MODE, mode);
}
