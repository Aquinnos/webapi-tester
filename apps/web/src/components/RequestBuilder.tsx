import { useState, useEffect } from 'react';
import type { HttpMethod, ProxyForwardRequestDto } from '@webapi-tester/shared';
import { proxyForward } from '../lib/proxy-fetch.js';
import { ApiError } from '../lib/api.js';
import { ResponseViewer } from './ResponseViewer.js';
import { AgentError, agentForward } from '../lib/proxy-agent-fetch.js';
import type { ProxyResponseDto } from '@webapi-tester/shared';

const METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
];

type Transport = 'server' | 'agent';

const TRANSPORTS: ReadonlyArray<readonly [Transport, string]> = [
  ['server', 'przez serwer'],
  ['agent', 'agent lokalny'],
];

export interface RequestSeed {
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
  baseUrl?: string;
}

interface RequestBuilderProps {
  accessToken?: string;
  seed: RequestSeed | null;
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

export function RequestBuilder({
  accessToken,
  seed,
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
  const [transport, setTransport] = useState<Transport>(
    accessToken ? 'server' : 'agent',
  );
  const [response, setResponse] = useState<ProxyResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canUseServer = Boolean(accessToken);
  const effectiveTransport: Transport = canUseServer ? transport : 'agent';

  useEffect(() => {
    if (!seed) return;
    setMethod(seed.method);
    setUrl(seed.url);
    setHeaders(headersToRows(seed.headers));
    setBody(seed.body);
    setBaseUrl(seed.baseUrl ?? null);
    setResponse(null);
    setError(null);
    onSeedApplied?.();
  }, [seed]);

  async function handleSend() {
    setError(null);
    setResponse(null);
    setLoading(true);

    const headerObj = rowsToHeaders(headers);
    const dto: ProxyForwardRequestDto = {
      method,
      url,
      headers: headerObj,
      body,
      bodyEncoding: 'utf-8',
      ...(baseUrl ? { baseUrl } : {}),
    };

    try {
      if (!accessToken || effectiveTransport === 'agent') {
        setResponse(await agentForward(dto));
      } else {
        setResponse(await proxyForward(dto, accessToken));
        onSent?.();
      }
    } catch (err) {
      if (err instanceof ApiError || err instanceof AgentError) {
        setError(err.details ? `${err.message}: ${err.details}` : err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
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
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-3">Żądanie</h2>

        <div className="flex gap-2 mb-3">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            className="border p-2 rounded font-mono bg-white"
          >
            {METHODS.map((m) => (
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
            className="border p-2 rounded flex-1 font-mono text-sm"
          />
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm">Nagłówki</h3>
            <button
              onClick={addHeader}
              className="text-sm text-blue-600 hover:underline"
            >
              + Dodaj
            </button>
          </div>
          {headers.map((h, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                value={h.key}
                onChange={(e) => updateHeader(i, 'key', e.target.value)}
                placeholder="Header"
                className="border p-1 rounded flex-1 font-mono text-sm"
              />
              <input
                value={h.value}
                onChange={(e) => updateHeader(i, 'value', e.target.value)}
                placeholder="Value"
                className="border p-1 rounded flex-1 font-mono text-sm"
              />
              <button
                onClick={() => removeHeader(i)}
                className="text-red-600 px-2 hover:bg-red-50 rounded"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <h3 className="font-semibold text-sm mb-2">Body</h3>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{"key": "value"}'
            className="border p-2 rounded w-full h-32 font-mono text-sm"
          />
        </div>

        <div className="flex gap-1 mb-3" role="group" aria-label="Transport">
          {TRANSPORTS.map(([value, label]) => {
            const unavailable = value === 'server' && !canUseServer;
            return (
              <button
                key={value}
                type="button"
                disabled={unavailable}
                title={
                  unavailable
                    ? 'Wysyłka przez serwer wymaga zalogowania'
                    : undefined
                }
                onClick={() => setTransport(value)}
                className={
                  effectiveTransport === value
                    ? 'px-3 py-1 rounded text-sm bg-blue-600 text-white'
                    : `px-3 py-1 rounded text-sm bg-gray-100 ${
                        unavailable
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-gray-200'
                      }`
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
        >
          {loading ? 'Wysyłanie...' : 'Wyślij'}
        </button>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-3">Odpowiedź</h2>
        <ResponseViewer response={response} />
      </section>
    </div>
  );
}
