import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const isDevelopment = () =>
  __DEV__ &&
  process.env.NODE_ENV !== 'production' &&
  !Constants.appOwnership?.includes('expo') &&
  Constants.executionEnvironment !== 'storeClient';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
export const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';
export const GOOGLE_CLIENT_ID = Platform.OS === 'ios' ? GOOGLE_CLIENT_ID_IOS : GOOGLE_CLIENT_ID_WEB;

export const TOKEN_STORAGE_KEY = 'fromfeed_auth_token';
export const USER_STORAGE_KEY = 'fromfeed_auth_user';
export const EXPIRES_AT_STORAGE_KEY = 'fromfeed_auth_expires_at';

export const SECURE_STORE_IOS_OPTIONS = Platform.OS === 'ios'
  ? { accessGroup: 'group.fr.sweizeur.fromfeed' as const }
  : {};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username?: string;
  image?: string;
}

export interface AuthSessionData {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface AuthResult {
  success: boolean;
  data?: AuthSessionData;
  errorCode?: 'RATE_LIMIT' | 'NETWORK_ERROR' | 'INVALID_TOKEN' | 'UNKNOWN';
  errorMessage?: string;
}

export function getReverseClientId(clientId: string): string {
  const clientIdWithoutSuffix = clientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${clientIdWithoutSuffix}`;
}
