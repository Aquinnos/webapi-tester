import { useState, type FormEvent } from 'react';
import type { AuthSuccessDto } from '@webapi-tester/shared';
import { api, ApiError } from '../lib/api';
import { saveAuth } from '../lib/auth';

type AuthMode = 'login' | 'register';

interface AuthFormProps {
  onSuccess: (auth: AuthSuccessDto) => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
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

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow">
      <h1 className="text-xl font-bold mb-4">WebAPI Tester</h1>
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
  );
}
