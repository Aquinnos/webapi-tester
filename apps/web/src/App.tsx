import { useState } from 'react';
import { AuthForm } from './components/AuthForm.js';
import {
  RequestBuilder,
  type RequestSeed,
} from './components/RequestBuilder.js';
import { Collections } from './components/Collections.js';
import { HistoryList } from './components/HistoryList.js';
import { OpenApiImporter } from './components/OpenApiImporter.js';
import { loadAuth, clearAuth, type StoredAuth } from './lib/auth.js';

export function App() {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());
  const [requestSeed, setRequestSeed] = useState<RequestSeed | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [showImporter, setShowImporter] = useState(false);
  const [collectionsKey, setCollectionsKey] = useState(0);
  const [currentRequest, setCurrentRequest] = useState<RequestSeed | null>(
    null,
  );

  function handleLogout() {
    clearAuth();
    setAuth(null);
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

  function handleFormChange(
    method: RequestSeed['method'],
    url: string,
    headers: Record<string, string>,
    body: string,
  ) {
    setCurrentRequest({ name: 'Current', method, url, headers, body });
  }

  if (!auth) {
    return <AuthForm onSuccess={() => setAuth(loadAuth())} />;
  }

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">WebAPI Tester</h1>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">{auth.user.email}</span>
          <button
            onClick={handleLogout}
            className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300"
          >
            Wyloguj
          </button>
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
          accessToken={auth.accessToken}
          seed={requestSeed}
          onSent={handleSent}
          onSeedApplied={handleSeedApplied}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Collections
            accessToken={auth.accessToken}
            currentRequest={currentRequest}
            onLoadRequest={handleLoadRequest}
            refreshKey={collectionsKey}
          />
          <HistoryList accessToken={auth.accessToken} refreshKey={historyKey} />
          {showImporter && (
            <OpenApiImporter
              accessToken={auth.accessToken}
              onClose={() => setShowImporter(false)}
              onImported={() => setCollectionsKey((k) => k + 1)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
