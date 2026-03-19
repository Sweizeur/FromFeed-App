/**
 * Barrel file — re-exports all auth modules.
 * External consumers keep importing from '@/lib/auth/auth-mobile' without changes.
 */
export type { AuthUser, AuthSessionData, AuthResult } from './auth-config';
export { isDevelopment, BACKEND_URL, GOOGLE_CLIENT_ID } from './auth-config';

export {
  getStoredToken,
  storeToken,
  clearToken,
  getStoredUser,
  storeUser,
  getStoredExpiresAt,
  storeExpiresAt,
} from './auth-storage';

export { signInWithGoogle } from './auth-oauth';
export { signOut, refreshSession, isAuthenticated } from './auth-session';
