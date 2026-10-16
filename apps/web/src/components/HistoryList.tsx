import { useEffect, useState } from 'react';
import { historyApi, ApiError } from '../lib/api.js';
import type { HistoryEntryDto } from '@webapi-tester/shared';

interface HistoryListProps {
  accessToken: string;
  refreshKey: number;
}

export function HistoryList({ accessToken, refreshKey }: HistoryListProps) {
  const [entries, setEntries] = useState<HistoryEntryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [accessToken, refreshKey]);

  async function load() {
    try {
      const res = await historyApi.list(accessToken);
      setEntries(res.entries);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Usunąć wpis?')) return;
    try {
      await historyApi.remove(accessToken, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleClear() {
    if (!confirm('Wyczyścić całą historię?')) return;
    try {
      await historyApi.clear(accessToken);
      setEntries([]);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function statusClass(status: number): string {
    if (status >= 500) return 'text-red-700';
    if (status >= 400) return 'text-orange-600';
    if (status >= 300) return 'text-yellow-600';
    if (status >= 200) return 'text-green-700';
    return 'text-gray-700';
  }

  return (
    <section className="bg-white p-4 rounded shadow">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold">Historia</h2>
        {entries.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-red-600 hover:underline"
          >
            Wyczyść wszystko
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <ul className="space-y-1">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-2 border rounded p-2 text-sm"
          >
            <span className="font-mono text-gray-500 text-xs w-12">
              {e.method}
            </span>
            <span
              className={`font-mono font-bold w-10 ${statusClass(e.status)}`}
            >
              {e.status}
            </span>
            <span className="font-mono text-xs text-gray-600 w-16 text-right">
              {e.durationMs}ms
            </span>
            <span className="font-mono text-xs flex-1 truncate" title={e.url}>
              {e.url}
            </span>
            <button
              onClick={() => handleDelete(e.id)}
              className="text-red-600 hover:underline text-xs"
            >
              ×
            </button>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-xs text-gray-500 py-2 text-center">
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
