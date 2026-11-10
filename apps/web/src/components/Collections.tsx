import { useEffect, useState } from 'react';
import { collectionsApi, ApiError } from '../lib/api.js';
import { methodClass } from '../lib/http-methods.js';
import type {
  CollectionDto,
  CollectionWithRequestsDto,
  RequestDto,
  UpdateRequestDto,
} from '@webapi-tester/shared';
import type { RequestSeed, RequestDraft } from './RequestBuilder.js';
import { RequestEditor } from './RequestEditor.js';

interface CollectionsProps {
  accessToken: string;
  currentRequest: RequestDraft | null;
  onLoadRequest: (seed: RequestSeed) => void;
  refreshKey?: number;
}

export function Collections({
  accessToken,
  currentRequest,
  onLoadRequest,
  refreshKey = 0,
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [savingRequest, setSavingRequest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [accessToken, refreshKey]);

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

  async function handleRenameSave(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setError(null);
    try {
      await collectionsApi.update(accessToken, id, { name });
      setRenamingId(null);
      setRenameValue('');
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleUpdateRequest(id: string, dto: UpdateRequestDto) {
    setError(null);
    setSavingRequest(true);
    try {
      await collectionsApi.updateRequest(accessToken, id, dto);
      setEditingRequestId(null);
      if (expanded) {
        const detail = await collectionsApi.get(accessToken, expanded.id);
        setExpanded(detail);
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSavingRequest(false);
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
      ...(r.baseUrl ? { baseUrl: r.baseUrl } : {}),
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
        ...(currentRequest.baseUrl
          ? { baseUrl: currentRequest.baseUrl }
          : {}),
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
    <section className="card">
      <h2 className="card-title">Kolekcje</h2>

      <div className="flex gap-2 mb-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nowa kolekcja..."
          className="field flex-1"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          aria-label="Utwórz kolekcję"
          className="btn-primary w-11 shrink-0"
        >
          +
        </button>
      </div>

      {currentRequest && (
        <button
          onClick={() => setShowSave((v) => !v)}
          className="text-sm text-blue-700 hover:underline mb-3 px-2 py-1.5"
        >
          {showSave ? 'Anuluj zapis' : 'Zapisz bieżące żądanie do kolekcji'}
        </button>
      )}

      {showSave && currentRequest && (
        <div className="border border-slate-200 rounded-lg p-3 mb-3 bg-slate-50">
          <p className="text-xs text-slate-600 mb-2 font-mono truncate">
            {currentRequest.method} {currentRequest.url}
          </p>
          <input
            value={saveRequestName}
            onChange={(e) => setSaveRequestName(e.target.value)}
            placeholder="Nazwa zapytania"
            className="field mb-2"
          />
          <select
            value={saveCollectionId}
            onChange={(e) => setSaveCollectionId(e.target.value)}
            className="field mb-2"
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
            className="btn-primary"
          >
            Zapisz
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <ul className="space-y-1">
        {collections.map((c) => (
          <li key={c.id} className="border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between p-2 hover:bg-slate-50">
              {renamingId === c.id ? (
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    className="field flex-1 min-w-[8rem]"
                  />
                  <button
                    onClick={() => handleRenameSave(c.id)}
                    disabled={!renameValue.trim()}
                    className="btn-primary px-2 py-1"
                  >
                    Zapisz
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="btn-secondary px-2 py-1"
                  >
                    Anuluj
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleExpand(c.id)}
                    className="flex-1 min-w-0 text-left text-sm font-medium py-2"
                  >
                    {expandedId === c.id ? '▼' : '▶'} {c.name}
                  </button>
                  <button
                    onClick={() => {
                      setRenamingId(c.id);
                      setRenameValue(c.name);
                    }}
                    className="text-xs text-blue-700 hover:underline px-2 py-2"
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => handleDeleteCollection(c.id)}
                    className="text-xs text-rose-600 hover:underline px-2 py-2"
                  >
                    Usuń
                  </button>
                </>
              )}
            </div>
            {expandedId === c.id && expanded && (
              <ul className="border-t border-slate-200 bg-slate-50 px-2 py-1">
                {expanded.requests.length === 0 && (
                  <li className="text-xs text-slate-500 py-1">Pusto</li>
                )}
                {expanded.requests.map((r) =>
                  editingRequestId === r.id ? (
                    <li key={r.id}>
                      <RequestEditor
                        request={r}
                        saving={savingRequest}
                        onSave={handleUpdateRequest}
                        onCancel={() => setEditingRequestId(null)}
                      />
                    </li>
                  ) : (
                    <li
                      key={r.id}
                      className="flex items-center justify-between py-1 text-xs"
                    >
                      <button
                        onClick={() => handleLoadRequest(r)}
                        className="flex-1 min-w-0 text-left font-mono py-2"
                      >
                        <span
                          className={`mr-1 inline-block font-bold px-1.5 py-0.5 rounded text-[10px] ${methodClass(r.method)}`}
                        >
                          {r.method}
                        </span>
                        {r.name}
                      </button>
                      <button
                        onClick={() => setEditingRequestId(r.id)}
                        className="text-blue-700 hover:underline px-2 py-2"
                      >
                        Edytuj
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(r.id)}
                        aria-label="Usuń zapytanie"
                        className="text-rose-600 hover:underline px-2 py-2"
                      >
                        ×
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </li>
        ))}
        {collections.length === 0 && (
          <li className="text-xs text-slate-500 py-4 text-center">
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
