import { useState } from 'react';
import type { HttpMethod, ProxyForwardRequestDto } from '@webapi-tester/shared';
import { proxyForward } from '../lib/proxy-fetch.js';
import { ApiError } from '../lib/api.js';
import { ResponseViewer } from './ResponseViewer.js';
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

interface RequestBuilderProps {
  accessToken: string;
}

interface HeaderRow {
  key: string;
  value: string;
}

export function RequestBuilder({ accessToken }: RequestBuilderProps) {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [headers, setHeaders] = useState<HeaderRow[]>([
    { key: 'Accept', value: 'application/json' },
  ]);
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<ProxyResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError(null);
    setResponse(null);
    setLoading(true);

    const headerObj: Record<string, string> = {};
    for (const { key, value } of headers) {
      const k = key.trim();
      if (k) headerObj[k] = value;
    }

    const dto: ProxyForwardRequestDto = {
      method,
      url,
      headers: headerObj,
      body,
      bodyEncoding: 'utf-8',
    };

    try {
      const res = await proxyForward(dto, accessToken);
      setResponse(res);
    } catch (err) {
      if (err instanceof ApiError) {
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
