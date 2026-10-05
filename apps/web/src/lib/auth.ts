import type { AuthSuccessDto } from '@webapi-tester/shared';

const ACCESS_TOKEN_KEY = 'webapi.accessToken';
const REFRESH_TOKEN_KEY = 'webapi.refreshToken';
const USER_KEY = 'webapi.user';

export interface StoredAuth {
  user: AuthSuccessDto['user'];
  accessToken: string;
  refreshToken: string;
}
export function saveAuth(auth: AuthSuccessDto): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function loadAuth(): StoredAuth | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  if (!accessToken || !refreshToken || !userJson) return null;
  try {
    return {
      accessToken,
      refreshToken,
      user: JSON.parse(userJson) as AuthSuccessDto['user'],
    };
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
