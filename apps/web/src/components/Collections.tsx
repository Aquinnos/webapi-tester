import { useEffect, useState } from 'react';
import { collectionsApi, ApiError } from '../lib/api';
import type {
  CollectionDto,
  CollectionWithRequestsDto,
  RequestDto,
  HttpMethod,
} from '@webapi-tester/shared';

export interface RequestSeed {
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
}

interface CollectionsProps {
  accessToken: string;
  currentRequest: RequestSeed | null;
  onLoadRequest: (seed: RequestSeed) => void;
}

export function Collections({
  accessToken,
  currentRequest,
  onLoadRequest,
}: CollectionsProps) {
  const [collections, setCollections] = useState<CollectionDto[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<CollectionWithRequestsDto | null>(
    null,
  );
  const [newName, setNewName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [saveCollectionId, setSaveCollectionId] = useState('');
  const [saveRequestName, setSaveRequestName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [accessToken]);

  async function refresh() {
    try {
      const list = await collectionsApi.list(accessToken);
      setCollections(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nie udało się wczytać kolekcji',
      );
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await collectionsApi.create(accessToken, { name });
      setNewName('');
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpanded(null);
      return;
    }
    setError(null);
    try {
      const detail = await collectionsApi.get(accessToken, id);
      setExpandedId(id);
      setExpanded(detail);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleDeleteCollection(id: string) {
    if (!confirm('Usunąć kolekcję i wszystkie jej zapytania?')) return;
    setError(null);
    try {
      await collectionsApi.remove(accessToken, id);
      if (expandedId === id) {
        setExpandedId(null);
        setExpanded(null);
      }
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleDeleteRequest(id: string) {
    if (!confirm('Usunąć zapytanie?')) return;
    setError(null);
    try {
      await collectionsApi.removeRequest(accessToken, id);
      if (expanded) {
        const detail = await collectionsApi.get(accessToken, expanded.id);
        setExpanded(detail);
      }
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function handleLoadRequest(r: RequestDto) {
    onLoadRequest({
      name: r.name,
      method: r.method,
      url: r.url,
      headers: r.headers,
      body: r.body,
    });
  }

  async function handleSaveSubmit() {
    if (!currentRequest || !saveCollectionId || !saveRequestName.trim()) return;
    setError(null);
    try {
      await collectionsApi.addRequest(accessToken, saveCollectionId, {
        name: saveRequestName.trim(),
        method: currentRequest.method,
        url: currentRequest.url,
        headers: currentRequest.headers,
        body: currentRequest.body,
      });
      setShowSave(false);
      setSaveCollectionId('');
      setSaveRequestName('');
      if (expandedId !== saveCollectionId) {
        const detail = await collectionsApi.get(accessToken, saveCollectionId);
        setExpandedId(saveCollectionId);
        setExpanded(detail);
      } else if (expanded) {
        const detail = await collectionsApi.get(accessToken, expanded.id);
        setExpanded(detail);
      }
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <section className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-bold mb-3">Kolekcje</h2>

      <div className="flex gap-2 mb-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nowa kolekcja..."
          className="border p-2 rounded flex-1 text-sm"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="bg-blue-600 text-white px-3 rounded text-sm disabled:opacity-50"
        >
          +
        </button>
      </div>

      {currentRequest && (
        <button
          onClick={() => setShowSave((v) => !v)}
          className="text-sm text-blue-600 hover:underline mb-3"
        >
          {showSave ? 'Anuluj zapis' : 'Zapisz bieżące żądanie do kolekcji'}
        </button>
      )}

      {showSave && currentRequest && (
        <div className="border rounded p-2 mb-3 bg-gray-50">
          <p className="text-xs text-gray-600 mb-2 font-mono truncate">
            {currentRequest.method} {currentRequest.url}
          </p>
          <input
            value={saveRequestName}
            onChange={(e) => setSaveRequestName(e.target.value)}
            placeholder="Nazwa zapytania"
            className="border p-1 rounded w-full text-sm mb-2"
          />
          <select
            value={saveCollectionId}
            onChange={(e) => setSaveCollectionId(e.target.value)}
            className="border p-1 rounded w-full text-sm mb-2"
          >
            <option value="">Wybierz kolekcję...</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleSaveSubmit}
            disabled={!saveCollectionId || !saveRequestName.trim()}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
          >
            Zapisz
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <ul className="space-y-1">
        {collections.map((c) => (
          <li key={c.id} className="border rounded">
            <div className="flex items-center justify-between p-2 hover:bg-gray-50">
              <button
                onClick={() => handleExpand(c.id)}
                className="flex-1 text-left text-sm font-medium"
              >
                {expandedId === c.id ? '▼' : '▶'} {c.name}
              </button>
              <button
                onClick={() => handleDeleteCollection(c.id)}
                className="text-red-600 text-xs hover:underline"
              >
                Usuń
              </button>
            </div>
            {expandedId === c.id && expanded && (
              <ul className="border-t bg-gray-50 px-2 py-1">
                {expanded.requests.length === 0 && (
                  <li className="text-xs text-gray-500 py-1">Pusto</li>
                )}
                {expanded.requests.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between py-1 text-xs"
                  >
                    <button
                      onClick={() => handleLoadRequest(r)}
                      className="flex-1 text-left font-mono"
                    >
                      <span className="text-gray-500 mr-1">{r.method}</span>
                      {r.name}
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(r.id)}
                      className="text-red-600 hover:underline ml-2"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {collections.length === 0 && (
          <li className="text-xs text-gray-500 py-2 text-center">
            Brak kolekcji. Utwórz pierwszą powyżej.
          </li>
        )}
      </ul>
    </section>
  );
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) {
    return err.details ? `${err.message}: ${err.details}` : err.message;
  }
  return err instanceof Error ? err.message : 'Nieznany błąd';
}
