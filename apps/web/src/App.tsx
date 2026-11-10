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
import { AccountPanel } from './components/AccountPanel.js';
import { loadAuth, clearAuth, type StoredAuth } from './lib/auth.js';
import { authApi } from './lib/api.js';

export function App() {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());
  const [requestSeed, setRequestSeed] = useState<RequestSeed | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [showImporter, setShowImporter] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
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

  function handleAccountDeleted() {
    clearAuth();
    setAuth(null);
    setShowAccount(false);
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
    <div className="min-h-screen flex flex-col">
      <header className="bg-white text-black">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 justify-between ">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">
              WebAPI Tester
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {auth ? (
              <>
                <span className="hidden truncate text-sm text-black sm:inline">
                  {auth.user.email}
                </span>
                <button
                  onClick={() => setShowAccount(true)}
                  className="btn-secondary"
                >
                  Konto
                </button>
                <button onClick={handleLogout} className="btn-secondary">
                  Wyloguj
                </button>
              </>
            ) : (
              <>
                <span className="hidden text-sm text-black sm:inline">
                  Gość
                </span>
                <button
                  onClick={() => setShowAuth(true)}
                  className="btn-primary"
                >
                  <span className="sm:hidden">Zaloguj</span>
                  <span className="hidden sm:inline">
                    Zaloguj / Zarejestruj
                  </span>
                </button>
              </>
            )}
            <button
              onClick={() => setShowImporter(true)}
              className="btn-primary"
            >
              <span className="sm:hidden">Import</span>
              <span className="hidden sm:inline">Import OpenAPI</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-4">
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
        <AuthForm
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuth(false)}
        />
      )}
      {showAccount && auth && (
        <AccountPanel
          accessToken={auth.accessToken}
          onAuthChanged={(next) => setAuth(next)}
          onAccountDeleted={handleAccountDeleted}
          onClose={() => setShowAccount(false)}
        />
      )}
    </div>
  );
}

function GuestNotice({ title }: { title: string }) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <p className="text-sm text-slate-600">
        Ta sekcja jest dostępna po zalogowaniu. Kolekcje i historia żądań są
        przechowywane dla zalogowanego użytkownika.
      </p>
    </section>
  );
}
