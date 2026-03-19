import { isDevelopment, BACKEND_URL } from './auth-config';
import type { AuthSessionData } from './auth-config';
import { getStoredToken, storeToken, storeUser, storeExpiresAt, getStoredExpiresAt, clearToken } from './auth-storage';

export async function signOut(): Promise<void> {
  const token = await getStoredToken();

  if (token) {
    try {
      await fetch(`${BACKEND_URL}/api/auth/mobile/sign-out`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      if (isDevelopment()) console.error('Error signing out on server:', error);
    }
  }

  await clearToken();
}

export async function refreshSession(): Promise<AuthSessionData | null> {
  const token = await getStoredToken();
  if (!token) return null;

  try {
    if (isDevelopment()) {
      console.log('[Auth] Rafraîchissement de la session, URL:', `${BACKEND_URL}/api/auth/mobile/refresh-session`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(`${BACKEND_URL}/api/auth/mobile/refresh-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(BACKEND_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
        },
        signal: controller.signal,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        __DEV__ && console.error('[Auth] Request timeout');
        return null;
      }
      __DEV__ && console.error('[Auth] Network error:', error);
      return null;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (isDevelopment()) console.warn('[Auth] Session refresh failed, status:', response.status);
      await clearToken();
      return null;
    }

    const authSession: AuthSessionData = await response.json();
    await storeToken(authSession.token);
    await storeUser(authSession.user);
    await storeExpiresAt(authSession.expiresAt);
    return authSession;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Network request failed') {
      if (isDevelopment()) {
        console.error('[Auth] Erreur réseau lors du rafraîchissement de la session:', error);
      }
      return null;
    }

    if (isDevelopment()) console.error('[Auth] Erreur lors du rafraîchissement de la session:', error);
    await clearToken();
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;

  const expiresAt = await getStoredExpiresAt();
  if (expiresAt) {
    const expiryDate = new Date(expiresAt);
    if (expiryDate.getTime() <= Date.now()) return false;
  }

  return true;
}
