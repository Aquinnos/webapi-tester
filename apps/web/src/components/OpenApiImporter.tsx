import { useState, type ChangeEvent } from 'react';
import { openApiApi, collectionsApi, ApiError } from '../lib/api.js';
import type { GeneratedRequestDto } from '@webapi-tester/shared';

interface OpenApiImporterProps {
  accessToken?: string;
  onClose: () => void;
  onImported: () => void;
}

export function OpenApiImporter({
  accessToken,
  onClose,
  onImported,
}: OpenApiImporterProps) {
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState(
    'https://petstore3.swagger.io/api/v3/openapi.json',
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [requests, setRequests] = useState<GeneratedRequestDto[]>([]);
  const [collectionName, setCollectionName] = useState('');

  async function handleImport() {
    setError(null);
    setLoading(true);
    setRequests([]);
    try {
      const dto = mode === 'url' ? { url } : { fileContent: fileContent ?? '' };
      const result = await openApiApi.import(dto, accessToken);
      if ('error' in result) {
        setError(`${result.error}: ${result.details}`);
        return;
      }
      setTitle(result.title);
      setVersion(result.version);
      setRequests(result.requests);
      setCollectionName(result.title);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileContent(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsText(file);
  }

  async function handleSave() {
    if (!accessToken) {
      setError('Zaloguj się, aby zapisać wygenerowaną kolekcję.');
      return;
    }
    if (!collectionName.trim() || requests.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const collection = await collectionsApi.create(accessToken, {
        name: collectionName.trim(),
      });
      for (const r of requests) {
        await collectionsApi.addRequest(accessToken, collection.id, {
          name: r.name,
          method: r.method,
          url: r.url,
          headers: r.headers,
          body: r.body,
          ...(r.baseUrl ? { baseUrl: r.baseUrl } : {}),
        });
      }
      onImported();
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Import specyfikacji OpenAPI</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 border-b mb-4">
          <button
            onClick={() => setMode('url')}
            className={`px-4 py-2 text-sm ${
              mode === 'url'
                ? 'border-b-2 border-blue-600 font-semibold'
                : 'text-gray-600'
            }`}
          >
            Z URL
          </button>
          <button
            onClick={() => setMode('file')}
            className={`px-4 py-2 text-sm ${
              mode === 'file'
                ? 'border-b-2 border-blue-600 font-semibold'
                : 'text-gray-600'
            }`}
          >
            Z pliku
          </button>
        </div>

        {mode === 'url' ? (
          <div className="flex gap-2 mb-4">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/openapi.json"
              className="border p-2 rounded flex-1 font-mono text-sm"
            />
            <button
              onClick={handleImport}
              disabled={loading || !url}
              className="bg-blue-600 text-white px-4 rounded text-sm disabled:opacity-50"
            >
              {loading ? '...' : 'Importuj'}
            </button>
          </div>
        ) : (
          <div className="mb-4">
            <input
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileChange}
              className="mb-2 text-sm"
            />
            {fileName && (
              <p className="text-sm text-gray-600 mb-2">Wybrano: {fileName}</p>
            )}
            <button
              onClick={handleImport}
              disabled={loading || !fileContent}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              {loading ? '...' : 'Importuj'}
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p className="text-red-700 text-sm font-semibold">Błąd importu</p>
            <p className="text-red-600 text-sm break-words">{error}</p>
          </div>
        )}

        {requests.length > 0 && (
          <div>
            <h3 className="font-bold mb-2">
              {title} (v{version}) — {requests.length} zapytań
            </h3>
            <ul className="max-h-48 overflow-y-auto border rounded p-2 bg-gray-50 mb-4 text-sm">
              {requests.map((r, i) => (
                <li key={i} className="font-mono py-1 flex gap-2">
                  <span className="text-gray-500 w-12 shrink-0">
                    {r.method}
                  </span>
                  <span className="truncate" title={r.description}>
                    {r.name}
                  </span>
                </li>
              ))}
            </ul>

            <label className="block text-sm font-semibold mb-1">
              Nazwa kolekcji
            </label>
            <input
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            />

            <div className="flex gap-2 items-center">
              {accessToken ? (
                <button
                  onClick={handleSave}
                  disabled={saving || !collectionName.trim()}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                  {saving
                    ? 'Zapisuję...'
                    : `Utwórz kolekcję (${requests.length} zapytań)`}
                </button>
              ) : (
                <p className="text-sm text-gray-600">
                  Zaloguj się, aby zapisać wygenerowaną kolekcję.
                </p>
              )}
              <button
                onClick={onClose}
                className="bg-gray-200 px-4 py-2 rounded text-sm"
              >
                Anuluj
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) {
    return err.details ? `${err.message}: ${err.details}` : err.message;
  }
  return err instanceof Error ? err.message : 'Nieznany błąd';
}
