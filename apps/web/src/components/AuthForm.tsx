import { useState, type FormEvent } from 'react';
import type { AuthSuccessDto } from '@webapi-tester/shared';
import { api, ApiError } from '../lib/api.js';
import { saveAuth } from '../lib/auth.js';

type AuthMode = 'login' | 'register';

interface AuthFormProps {
  onSuccess: (auth: AuthSuccessDto) => void;
  onClose?: () => void;
}

export function AuthForm({ onSuccess, onClose }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const auth = await api<AuthSuccessDto>(path, {
        method: 'POST',
        body: { email, password },
      });
      saveAuth(auth);
      onSuccess(auth);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.details ? `${err.message}: ${err.details}` : err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }

  const card = (
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div className="flex justify-between items-center p-6 pb-0">
        <h1 className="text-xl font-bold">WebAPI Tester</h1>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
          >
            &times;
          </button>
        )}
      </div>
      <div className="p-6 pt-4">
        <div className="flex gap-2 mb-4 border-b">
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`pb-2 ${mode === 'register' ? 'border-b-2 border-blue-600 font-bold' : ''}`}
          >
            Rejestracja
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`pb-2 ${mode === 'login' ? 'border-b-2 border-blue-600 font-bold' : ''}`}
          >
            Logowanie
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border p-2 rounded"
          />
          <input
            type="password"
            placeholder="hasło (min. 8 znaków)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="border p-2 rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white p-2 rounded disabled:opacity-50"
          >
            {loading ? '...' : mode === 'register' ? 'Zarejestruj' : 'Zaloguj'}
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      </div>
    </div>
  );

  if (!onClose) {
    return <div className="max-w-md mx-auto mt-12">{card}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      {card}
    </div>
  );
}
