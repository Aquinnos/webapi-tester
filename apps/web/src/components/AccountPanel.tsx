import { useState, type FormEvent } from 'react';
import type { AuthSuccessDto } from '@webapi-tester/shared';
import { authApi, ApiError } from '../lib/api.js';
import { saveAuth } from '../lib/auth.js';

const MIN_PASSWORD_LENGTH = 8;

interface AccountPanelProps {
  accessToken: string;
  onAuthChanged: (auth: AuthSuccessDto) => void;
  onAccountDeleted: () => void;
  onClose: () => void;
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) {
    return err.details ? `${err.message}: ${err.details}` : err.message;
  }
  return err instanceof Error ? err.message : 'Nieznany błąd';
}

export function AccountPanel({
  accessToken,
  onAuthChanged,
  onAccountDeleted,
  onClose,
}: AccountPanelProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordRepeat, setNewPasswordRepeat] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function clearPasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordRepeat('');
    setPasswordError(null);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordDone(false);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(
        `Nowe hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków`,
      );
      return;
    }
    if (newPassword !== newPasswordRepeat) {
      setPasswordError('Nowe hasła nie są identyczne');
      return;
    }

    setPasswordBusy(true);
    try {
      const auth = await authApi.changePassword(
        accessToken,
        currentPassword,
        newPassword,
      );
      saveAuth(auth);
      onAuthChanged(auth);
      clearPasswordForm();
      setPasswordDone(true);
    } catch (err) {
      setPasswordError(messageOf(err));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await authApi.deleteAccount(accessToken, deletePassword);
      onAccountDeleted();
    } catch (err) {
      setDeleteError(messageOf(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md my-8">
        <div className="flex justify-between items-center p-6 pb-0">
          <h1 className="text-xl font-bold text-slate-800">Zarządzanie kontem</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        <div className="p-6 pt-4 flex flex-col gap-8">
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <h2 className="font-bold text-slate-800">Zmiana hasła</h2>
            <input
              type="password"
              placeholder="obecne hasło"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="field"
            />
            <input
              type="password"
              placeholder={`nowe hasło (min. ${MIN_PASSWORD_LENGTH} znaków)`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="field"
            />
            <input
              type="password"
              placeholder="powtórz nowe hasło"
              value={newPasswordRepeat}
              onChange={(e) => setNewPasswordRepeat(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="field"
            />
            <button type="submit" disabled={passwordBusy} className="btn-primary w-full">
              {passwordBusy ? '...' : 'Zmień hasło'}
            </button>
            <p className="text-sm text-slate-600">
              Po zmianie hasła pozostałe sesje zostaną wylogowane.
            </p>
            {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}
            {passwordDone && !passwordError && (
              <p className="text-emerald-600 text-sm">Hasło zostało zmienione.</p>
            )}
          </form>

          <form onSubmit={handleDeleteAccount} className="flex flex-col gap-3">
            <h2 className="font-bold text-rose-600">Usunięcie konta</h2>
            <p className="text-sm text-slate-600">
              Operacja jest nieodwracalna. Skasowane zostaną konto, wszystkie
              kolekcje zapytań oraz cała historia wykonanych żądań.
            </p>
            <input
              type="password"
              placeholder="potwierdź hasłem"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
              className="field"
            />
            <button type="submit" disabled={deleteBusy} className="btn-danger w-full">
              {deleteBusy ? '...' : 'Usuń konto na zawsze'}
            </button>
            {deleteError && <p className="text-red-600 text-sm">{deleteError}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}