import { useState, useCallback } from 'react';
import { AuthForm } from './components/AuthForm.js';
import {
  RequestBuilder,
  type RequestSeed,
  type RequestDraft,
} from './components/RequestBuilder.js';
import { Collections } from './components/Collections.js';
import { HistoryList } from './components/HistoryList.js';
import { OpenApiImporter } from './components/OpenApiImporter.js';
import { loadAuth, clearAuth, type StoredAuth } from './lib/auth.js';
import { authApi } from './lib/api.js';

export function App() {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());
  const [requestSeed, setRequestSeed] = useState<RequestSeed | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [showImporter, setShowImporter] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [collectionsKey, setCollectionsKey] = useState(0);
  const [currentRequest, setCurrentRequest] = useState<RequestDraft | null>(
    null,
  );

  const accessToken = auth?.accessToken;

  async function handleLogout() {
    const current = auth;
    try {
      if (current) {
        await authApi.logout(current.refreshToken, current.accessToken);
      }
    } catch {
      // Revoking server-side is best effort; the local session must always end.
    } finally {
      clearAuth();
      setAuth(null);
    }
  }

  function handleAuthSuccess() {
    setAuth(loadAuth());
    setShowAuth(false);
  }

  function handleLoadRequest(seed: RequestSeed) {
    setRequestSeed(seed);
  }

  function handleSeedApplied() {
    setRequestSeed(null);
  }

  function handleSent() {
    setHistoryKey((k) => k + 1);
  }

  const handleFormChange = useCallback((draft: RequestDraft) => {
    setCurrentRequest(draft);
  }, []);

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">WebAPI Tester</h1>
        <div className="flex gap-2 items-center">
          {auth ? (
            <>
              <span className="text-sm text-gray-600">{auth.user.email}</span>
              <button
                onClick={handleLogout}
                className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300"
              >
                Wyloguj
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-600">Gość</span>
              <button
                onClick={() => setShowAuth(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Zaloguj / Zarejestruj
              </button>
            </>
          )}
          <button
            onClick={() => setShowImporter(true)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            Import OpenAPI
          </button>
        </div>
      </header>
      <main className="space-y-4">
        <RequestBuilder
          accessToken={accessToken}
          seed={requestSeed}
          onFormChange={handleFormChange}
          onSent={handleSent}
          onSeedApplied={handleSeedApplied}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {auth ? (
            <>
              <Collections
                accessToken={auth.accessToken}
                currentRequest={currentRequest}
                onLoadRequest={handleLoadRequest}
                refreshKey={collectionsKey}
              />
              <HistoryList
                accessToken={auth.accessToken}
                refreshKey={historyKey}
              />
            </>
          ) : (
            <>
              <GuestNotice title="Kolekcje" />
              <GuestNotice title="Historia żądań" />
            </>
          )}
          {showImporter && (
            <OpenApiImporter
              accessToken={accessToken}
              onClose={() => setShowImporter(false)}
              onImported={() => setCollectionsKey((k) => k + 1)}
            />
          )}
        </div>
      </main>
      {showAuth && (
        <AuthForm onSuccess={handleAuthSuccess} onClose={() => setShowAuth(false)} />
      )}
    </div>
  );
}

function GuestNotice({ title }: { title: string }) {
  return (
    <section className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <p className="text-sm text-gray-600">
        Ta sekcja jest dostępna po zalogowaniu. Kolekcje i historia żądań są
        przechowywane dla zalogowanego użytkownika.
      </p>
    </section>
  );
}
