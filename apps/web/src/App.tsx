import { useState } from 'react';
import { AuthForm } from './components/AuthForm.js';
import { RequestBuilder } from './components/RequestBuilder.js';
import { loadAuth, clearAuth, type StoredAuth } from './lib/auth.js';

export function App() {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());

  function handleLogout() {
    clearAuth();
    setAuth(null);
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
        </div>
      </header>
      <main>
        <RequestBuilder accessToken={auth.accessToken} />
      </main>
    </div>
  );
}
