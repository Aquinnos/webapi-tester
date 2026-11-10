import { useEffect, useState } from 'react';
import { historyApi, ApiError } from '../lib/api.js';
import { methodClass } from '../lib/http-methods.js';
import type { HistoryEntryDto, HistoryListItemDto } from '@webapi-tester/shared';

interface HistoryListProps {
  accessToken: string;
  refreshKey: number;
}

export function HistoryList({ accessToken, refreshKey }: HistoryListProps) {
  const [entries, setEntries] = useState<HistoryListItemDto[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryEntryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [accessToken, refreshKey]);

  async function load() {
    try {
      const res = await historyApi.list(accessToken);
      setEntries(res.entries);
      setExpandedId(null);
      setDetail(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleToggle(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setError(null);
    setExpandedId(id);
    setDetail(null);
    try {
      setDetail(await historyApi.get(accessToken, id));
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Usunąć wpis?')) return;
    try {
      await historyApi.remove(accessToken, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
        setDetail(null);
      }
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleClear() {
    if (!confirm('Wyczyścić całą historię?')) return;
    try {
      await historyApi.clear(accessToken);
      setEntries([]);
      setExpandedId(null);
      setDetail(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function statusClass(status: number): string {
    if (status >= 500) return 'text-rose-600';
    if (status >= 400) return 'text-orange-600';
    if (status >= 300) return 'text-amber-600';
    if (status >= 200) return 'text-emerald-600';
    return 'text-slate-700';
  }

  return (
    <section className="card">
      <div className="flex justify-between items-center mb-3 gap-2">
        <h2 className="card-title mb-0">Historia</h2>
        {entries.length > 0 && (
          <button onClick={handleClear} className="link-quiet touch-target">
            Wyczyść wszystko
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.id} className="border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 p-2 text-sm">
              <button
                onClick={() => handleToggle(e.id)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="flex items-center gap-2 mb-1">
                  <span className="text-slate-400 text-xs">
                    {expandedId === e.id ? '▼' : '▶'}
                  </span>
                  <span
                    className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${methodClass(e.method)}`}
                  >
                    {e.method}
                  </span>
                  <span
                    className={`font-mono font-bold text-xs ${statusClass(e.status)}`}
                  >
                    {e.status}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {e.durationMs} ms
                  </span>
                </span>
                <span
                  className="block font-mono text-xs text-slate-700 truncate"
                  title={e.url}
                >
                  {e.url}
                </span>
              </button>
              <button
                onClick={() => handleDelete(e.id)}
                aria-label="Usuń wpis z historii"
                className="btn-secondary touch-target text-rose-600 hover:bg-rose-50 hover:border-rose-200"
              >
                ×
              </button>
            </div>
            {expandedId === e.id && (
              <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
                {detail === null ? (
                  <p className="text-xs text-slate-500 py-1">Wczytywanie...</p>
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {detail.body || '(pusta treść odpowiedzi)'}
                  </pre>
                )}
              </div>
            )}
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-xs text-slate-500 py-4 text-center">
            Brak wpisów. Wyślij żądanie, żeby coś się tu pojawiło.
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
