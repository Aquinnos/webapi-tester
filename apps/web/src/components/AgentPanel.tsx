import { useState } from 'react';
import {
  AGENT_RUN_COMMAND,
  probeAgent,
  type AgentStatus,
} from '../lib/agent-client.js';
import type {
  AgentSettings,
  ForwardMode,
} from '../lib/agent-settings.js';

interface AgentPanelProps {
  settings: AgentSettings;
  mode: ForwardMode;
  status: AgentStatus | null;
  onSave: (settings: AgentSettings, mode: ForwardMode) => void;
  onClose: () => void;
}

const MODE_LABELS: Record<ForwardMode, string> = {
  auto: 'Agent, gdy jest dostępny (poza tym bezpośrednio)',
  agent: 'Zawsze przez agenta',
  direct: 'Zawsze bezpośrednio z przeglądarki',
};

export function AgentPanel({
  settings,
  mode,
  status,
  onSave,
  onClose,
}: AgentPanelProps) {
  const [url, setUrl] = useState(settings.url);
  const [key, setKey] = useState(settings.key);
  const [selectedMode, setSelectedMode] = useState<ForwardMode>(mode);
  const [probe, setProbe] = useState<AgentStatus | null>(status);
  const [checking, setChecking] = useState(false);

  async function handleCheck() {
    setChecking(true);
    setProbe(await probeAgent({ url, key }));
    setChecking(false);
  }

  function handleSave() {
    onSave({ url: url.trim(), key: key.trim() }, selectedMode);
  }

  const statusText = describeStatus(probe, key.length > 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-6 pb-0">
          <h1 className="text-xl font-bold text-slate-800">
            Lokalny agent proxy
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        <div className="p-6 pt-4 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Agent działa na Twoim komputerze i jest potrzebny przy testowaniu
            API bez nagłówków CORS oraz adresów w sieci lokalnej. Bez agenta
            aplikacja wysyła żądania wprost z przeglądarki.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700">
              Adres agenta
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://127.0.0.1:3002"
              className="field field-mono"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700">
              Klucz agenta
            </span>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="klucz wypisany w logu startowym agenta"
              className="field field-mono"
              autoComplete="off"
            />
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-semibold text-slate-700 mb-1">
              Tryb wysyłania
            </legend>
            {(Object.keys(MODE_LABELS) as ForwardMode[]).map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name="forward-mode"
                  value={value}
                  checked={selectedMode === value}
                  onChange={() => setSelectedMode(value)}
                />
                {MODE_LABELS[value]}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="btn-secondary"
            >
              {checking ? 'Sprawdzanie...' : 'Sprawdź połączenie'}
            </button>
            <span className="text-sm text-slate-600">{statusText}</span>
          </div>

          <details className="text-sm text-slate-600">
            <summary className="cursor-pointer">
              Jak uruchomić agenta?
            </summary>
            <pre className="mt-2 p-3 bg-slate-100 rounded-md overflow-x-auto field-mono text-xs">
              {AGENT_RUN_COMMAND}
            </pre>
            <p className="mt-2">
              Klucz agenta znajdziesz w logach kontenera albo w terminalu, z
              którego uruchomiłeś agenta.
            </p>
          </details>

          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">
              Anuluj
            </button>
            <button type="button" onClick={handleSave} className="btn-primary">
              Zapisz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function describeStatus(status: AgentStatus | null, hasKey: boolean): string {
  if (!status) return 'Status nieznany.';
  if (!status.reachable) return 'Agent nie odpowiada.';
  if (!status.authorized) {
    return hasKey
      ? 'Agent działa, ale klucz jest nieprawidłowy.'
      : 'Agent działa, ale nie podano klucza.';
  }
  return 'Agent działa i klucz jest prawidłowy.';
}
