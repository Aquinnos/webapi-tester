import type { ProxyResponseDto } from '@webapi-tester/shared';
import { decodeBase64ToText } from '../lib/body.js';
import { statusTextFor } from '../lib/http-status.js';

interface ResponseViewerProps {
  response: ProxyResponseDto | null;
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-600';
  if (status >= 300 && status < 400) return 'text-amber-600';
  if (status >= 400 && status < 500) return 'text-orange-600';
  if (status >= 500) return 'text-rose-600';
  return 'text-slate-700';
}

export function ResponseViewer({ response }: ResponseViewerProps) {
  if (!response) {
    return (
      <p className="text-sm text-slate-500 italic">
        Wyślij żądanie, aby zobaczyć odpowiedź.
      </p>
    );
  }

  const text = decodeBase64ToText(response.bodyBase64);

  const isJson =
    response.bodyContentType.includes('json') || /^\s*[\{\[]/.test(text);

  let bodyContent = text;
  if (isJson) {
    try {
      bodyContent = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // zostaw oryginalny tekst
    }
  }

  return (
    <div>
      <div className="flex gap-6 mb-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Status
          </p>
          <p className={`font-bold text-2xl ${statusColor(response.status)}`}>
            {response.status}{' '}
            {statusTextFor(response.status, response.statusText)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Czas</p>
          <p className="font-bold text-2xl text-slate-800">
            {response.durationMs} ms
          </p>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          Nagłówki
        </h3>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono max-h-32 overflow-y-auto">
          {Object.entries(response.headers).map(([k, v]) => (
            <div key={k}>
              <span className="text-slate-500">{k}:</span> {v}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          Body ({response.bodyContentType || 'nieznany typ'})
        </h3>
        <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
          {bodyContent}
        </pre>
      </div>
    </div>
  );
}
