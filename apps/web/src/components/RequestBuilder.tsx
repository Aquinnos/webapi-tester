import { useState, useEffect } from 'react';
import type { HttpMethod, ProxyForwardRequestDto } from '@webapi-tester/shared';
import { historyApi } from '../lib/api.js';
import { decodeBase64ToText } from '../lib/body.js';
import { ResponseViewer } from './ResponseViewer.js';
import { agentForward } from '../lib/agent-client.js';
import { directForward } from '../lib/direct-client.js';
import { ForwardError } from '../lib/forward-error.js';
import type {
  AgentSettings,
  ForwardMode,
} from '../lib/agent-settings.js';
import { HTTP_METHODS, methodClass } from '../lib/http-methods.js';
import type { ProxyResponseDto } from '@webapi-tester/shared';

const MAX_HISTORY_BODY = 50_000;

export interface RequestSeed {
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
  baseUrl?: string;
}

export interface RequestDraft {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
  baseUrl?: string;
}

interface RequestBuilderProps {
  accessToken?: string;
  seed: RequestSeed | null;
  mode: ForwardMode;
  settings: AgentSettings;
  onFormChange?: (draft: RequestDraft) => void;
  onSent?: () => void;
  onSeedApplied?: () => void;
}

interface HeaderRow {
  key: string;
  value: string;
}

const DEFAULT_SEED: RequestSeed = {
  name: 'Untitled',
  method: 'GET',
  url: 'https://httpbin.org/get',
  headers: { Accept: 'application/json' },
  body: '',
};

function headersToRows(headers: Record<string, string>): HeaderRow[] {
  const entries = Object.entries(headers);
  if (entries.length === 0) return [{ key: '', value: '' }];
  return entries.map(([key, value]) => ({ key, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const { key, value } of rows) {
    const k = key.trim();
    if (k) obj[k] = value;
  }
  return obj;
}

// Historia jest funkcją dodatkową: jej zapis nie może unieważnić odpowiedzi,
// którą użytkownik właśnie wysłał i zobaczył w podglądzie.
async function saveHistoryEntry(
  accessToken: string,
  request: ProxyForwardRequestDto,
  response: ProxyResponseDto,
): Promise<void> {
  const text = decodeBase64ToText(response.bodyBase64);
  await historyApi
    .record(accessToken, {
      method: request.method,
      url: request.url,
      status: response.status,
      durationMs: response.durationMs,
      body: text.slice(0, MAX_HISTORY_BODY),
    })
    .catch(() => undefined);
}

export function RequestBuilder({
  accessToken,
  seed,
  mode,
  settings,
  onFormChange,
  onSent,
  onSeedApplied,
}: RequestBuilderProps) {
  const [method, setMethod] = useState<HttpMethod>(DEFAULT_SEED.method);
  const [url, setUrl] = useState(DEFAULT_SEED.url);
  const [headers, setHeaders] = useState<HeaderRow[]>(
    headersToRows(DEFAULT_SEED.headers),
  );
  const [body, setBody] = useState(DEFAULT_SEED.body);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [response, setResponse] = useState<ProxyResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onFormChange?.({
      method,
      url,
      headers: rowsToHeaders(headers),
      body,
      ...(baseUrl ? { baseUrl } : {}),
    });
  }, [method, url, headers, body, baseUrl, onFormChange]);

  useEffect(() => {
    if (!seed) return;
    setMethod(seed.method);
    setUrl(seed.url);
    setHeaders(headersToRows(seed.headers));
    setBody(seed.body);
    setBaseUrl(seed.baseUrl ?? null);
    setResponse(null);
    setError(null);
    setHint(null);
    onSeedApplied?.();
  }, [seed]);

  async function forward(dto: ProxyForwardRequestDto): Promise<ProxyResponseDto> {
    const useAgent =
      mode === 'agent' || (mode === 'auto' && settings.key.length > 0);
    if (!useAgent) {
      return directForward(dto);
    }
    try {
      return await agentForward(dto, settings);
    } catch (err) {
      if (mode !== 'auto' || !(err instanceof ForwardError) || !err.isNetwork) {
        throw err;
      }
      // Agent nie odpowiada, więc w trybie automatycznym próbujemy wysłać
      // żądanie wprost z przeglądarki.
      try {
        return await directForward(dto);
      } catch (directErr) {
        if (directErr instanceof ForwardError) {
          throw new ForwardError(
            directErr.message,
            directErr.kind,
            directErr.status,
            directErr.details,
            directErr.hint ?? err.hint,
          );
        }
        throw directErr;
      }
    }
  }

  async function handleSend() {
    setError(null);
    setHint(null);
    setResponse(null);
    setLoading(true);

    const dto: ProxyForwardRequestDto = {
      method,
      url,
      headers: rowsToHeaders(headers),
      body,
      bodyEncoding: 'utf-8',
      ...(baseUrl ? { baseUrl } : {}),
    };

    try {
      const result = await forward(dto);
      setResponse(result);
      if (accessToken) {
        await saveHistoryEntry(accessToken, dto, result);
        onSent?.();
      }
    } catch (err) {
      if (err instanceof ForwardError) {
        setError(err.details ? `${err.message}: ${err.details}` : err.message);
        setHint(err.hint ?? null);
      } else {
        setError(err instanceof Error ? err.message : 'Nieznany błąd');
      }
    } finally {
      setLoading(false);
    }
  }

  function updateHeader(index: number, field: keyof HeaderRow, value: string) {
    setHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    );
  }

  function addHeader() {
    setHeaders((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeHeader(index: number) {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="card">
        <h2 className="card-title">Żądanie</h2>

        <div className="flex gap-2 mb-3">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            aria-label="Metoda HTTP"
            className={`method-select ${methodClass(method)}`}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            className="field field-mono flex-1"
          />
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-700">Nagłówki</h3>
            <button
              onClick={addHeader}
              className="text-sm text-blue-700 hover:underline touch-target"
            >
              + Dodaj
            </button>
          </div>
          {headers.map((h, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 mb-2 lg:flex lg:items-center lg:gap-2"
            >
              <input
                value={h.key}
                onChange={(e) => updateHeader(i, 'key', e.target.value)}
                placeholder="Nagłówek"
                className="field field-mono col-start-1 row-start-1 lg:flex-1"
              />
              <input
                value={h.value}
                onChange={(e) => updateHeader(i, 'value', e.target.value)}
                placeholder="Wartość"
                className="field field-mono col-start-1 row-start-2 lg:flex-1"
              />
              <button
                onClick={() => removeHeader(i)}
                aria-label="Usuń nagłówek"
                className="btn-secondary touch-target col-start-2 row-start-1 row-span-2 self-start text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Body</h3>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{"key": "value"}'
            className="field field-mono h-32 resize-y"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={loading}
          className="btn-primary w-full sm:w-auto"
        >
          {loading ? 'Wysyłanie...' : 'Wyślij'}
        </button>

        <p className="text-xs text-slate-500 mt-2">
          Tryb wysyłania: {modeLabel(mode)}
        </p>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        {hint && <p className="text-slate-600 text-sm mt-1">{hint}</p>}
      </section>

      <section className="card">
        <h2 className="card-title">Odpowiedź</h2>
        <ResponseViewer response={response} />
      </section>
    </div>
  );
}

function modeLabel(mode: ForwardMode): string {
  if (mode === 'agent') return 'zawsze przez lokalnego agenta proxy';
  if (mode === 'direct') return 'bezpośrednio z przeglądarki';
  return 'agent, gdy jest dostępny, w pozostałych przypadkach bezpośrednio';
}
