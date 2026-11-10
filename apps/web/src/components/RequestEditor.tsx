import { useState, type FormEvent } from 'react';
import type { HttpMethod, RequestDto, UpdateRequestDto } from '@webapi-tester/shared';
import { HTTP_METHODS, methodClass } from '../lib/http-methods.js';

interface RequestEditorProps {
  request: RequestDto;
  saving: boolean;
  onSave: (id: string, dto: UpdateRequestDto) => void;
  onCancel: () => void;
}

const EDITOR_FIELD =
  'w-full min-w-0 rounded border border-slate-300 px-2 py-1.5 text-xs ' +
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

export function RequestEditor({
  request,
  saving,
  onSave,
  onCancel,
}: RequestEditorProps) {
  const [name, setName] = useState(request.name);
  const [method, setMethod] = useState<HttpMethod>(request.method);
  const [url, setUrl] = useState(request.url);
  const [body, setBody] = useState(request.body);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !url.trim()) return;
    onSave(request.id, {
      name: trimmed,
      method,
      url: url.trim(),
      body,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1 py-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nazwa zapytania"
        className={EDITOR_FIELD}
      />
      <div className="flex gap-1">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          aria-label="Metoda HTTP"
          className={`method-select px-2 py-1.5 pr-7 text-xs ${methodClass(method)}`}
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Adres URL"
          className={`${EDITOR_FIELD} flex-1 font-mono`}
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ciało zapytania"
        rows={3}
        className={`${EDITOR_FIELD} font-mono`}
      />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={saving || !name.trim() || !url.trim()}
          className="btn-primary px-2 py-1 text-xs"
        >
          {saving ? 'Zapisuję...' : 'Zapisz'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary px-2 py-1 text-xs"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}