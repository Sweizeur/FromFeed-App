import { getStoredToken, refreshSession } from '../auth/auth-mobile';
import Constants from 'expo-constants';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * Préfixe les routes métier avec `/api/v1`. Laisse `/api/auth` et `/api/v1` inchangés.
 */
export function resolveVersionedEndpoint(endpoint: string): string {
  const qIdx = endpoint.indexOf('?');
  const pathPart = qIdx >= 0 ? endpoint.slice(0, qIdx) : endpoint;
  const query = qIdx >= 0 ? endpoint.slice(qIdx) : '';

  if (!pathPart.startsWith('/api/')) {
    return endpoint;
  }
  if (pathPart === '/api/auth' || pathPart.startsWith('/api/auth/')) {
    return endpoint;
  }
  if (pathPart === '/api/v1' || pathPart.startsWith('/api/v1/')) {
    return endpoint;
  }
  const rest = pathPart.slice(5);
  return `/api/v1/${rest}${query}`;
}

const isDevelopment = () =>
  __DEV__ &&
  process.env.NODE_ENV !== 'production' &&
  !Constants.appOwnership?.includes('expo') &&
  Constants.executionEnvironment !== 'storeClient';

export const devLog = (...args: unknown[]) => {
  if (isDevelopment()) console.log(...args);
};
export const devError = (...args: unknown[]) => {
  if (isDevelopment()) console.error(...args);
};
export const devWarn = (...args: unknown[]) => {
  if (isDevelopment()) console.warn(...args);
};

type ApiRequestOptions = RequestInit & { timeoutMs?: number };
type ApiRequestInternalOptions = ApiRequestOptions & { _retried401?: boolean };

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestInternalOptions = {}
): Promise<T | null> {
  const { _retried401, ...requestOptions } = options;
  const token = await getStoredToken();
  const { timeoutMs = 15000, ...fetchOptions } = requestOptions;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const resolved = resolveVersionedEndpoint(endpoint);
  devLog('[API] Requête vers:', `${BACKEND_URL}${resolved}`, 'Method:', options.method || 'GET');

  if (BACKEND_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${resolved}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const err = error as { name?: string; message?: string };
    if (err.name === 'AbortError') {
      devError('[API] Timeout:', resolved);
      return null;
    }
    const isNetworkError =
      err.message?.includes('Network request failed') || err.name === 'AbortError';
    if (!isNetworkError) {
      devError('[API] Erreur réseau:', error);
    }
    return null;
  }

  clearTimeout(timeoutId);
  devLog('[API] Réponse status:', response.status, 'ok:', response.ok);

  if (response.status === 401 && token && !_retried401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      devLog('[API] Session rafraîchie, retry de la requête');
      return apiRequest<T>(endpoint, { ...requestOptions, _retried401: true });
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    devError('[API] Erreur HTTP:', response.status, 'Body:', errorText);
    return null;
  }

  try {
    const data = await response.json();
    devLog('[API] Réponse JSON reçue');
    return data;
  } catch (parseError) {
    devError('[API] Erreur parsing JSON:', parseError);
    return null;
  }
}
