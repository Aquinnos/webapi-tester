import type { ProxyResponseDto } from '@webapi-tester/shared';

interface ResponseViewerProps {
  response: ProxyResponseDto | null;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-700';
  if (status >= 300 && status < 400) return 'text-yellow-700';
  if (status >= 400 && status < 500) return 'text-orange-700';
  if (status >= 500) return 'text-red-700';
  return 'text-gray-700';
}

export function ResponseViewer({ response }: ResponseViewerProps) {
  if (!response) {
    return (
      <p className="text-gray-500 italic">
        Wyślij żądanie, aby zobaczyć odpowiedź.
      </p>
    );
  }

  const bytes = decodeBase64(response.bodyBase64);
  const text = new TextDecoder('utf-8').decode(bytes);

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
      <div className="flex gap-6 mb-3 pb-3 border-b">
        <div>
          <p className="text-xs text-gray-500 uppercase">Status</p>
          <p className={`font-bold text-2xl ${statusColor(response.status)}`}>
            {response.status} {response.statusText}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Czas</p>
          <p className="font-bold text-2xl text-gray-800">
            {response.durationMs} ms
          </p>
        </div>
      </div>

      <div className="mb-3">
        <h3 className="font-semibold mb-2">Nagłówki</h3>
        <div className="bg-gray-50 p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
          {Object.entries(response.headers).map(([k, v]) => (
            <div key={k}>
              <span className="text-gray-600">{k}:</span> {v}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">
          Body ({response.bodyContentType || 'unknown'})
        </h3>
        <pre
          className="bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto 
  whitespace-pre-wrap break-all"
        >
          {bodyContent}
        </pre>
      </div>
    </div>
  );
}
