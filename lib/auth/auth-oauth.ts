import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import {
  isDevelopment,
  BACKEND_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_ID_IOS,
  getReverseClientId,
} from './auth-config';
import type { AuthResult, AuthSessionData } from './auth-config';
import { storeToken, storeUser, storeExpiresAt } from './auth-storage';

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

function generateBase64url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  // btoa available in Hermes (RN 0.76+)
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : manualBase64Encode(bytes);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').substring(0, 128);
}

function manualBase64Encode(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const a = bytes[i++];
    const b = i < bytes.length ? bytes[i++] : 0;
    const c = i < bytes.length ? bytes[i++] : 0;
    const bitmap = (a << 16) | (b << 8) | c;
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '=';
  }
  return result;
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!GOOGLE_CLIENT_ID) {
    if (isDevelopment()) console.error('Google Client ID not configured');
    return { success: false, errorCode: 'UNKNOWN', errorMessage: 'Configuration manquante' };
  }

  let redirectURI: string;
  if (Platform.OS === 'ios' && GOOGLE_CLIENT_ID_IOS) {
    const reverseClientId = getReverseClientId(GOOGLE_CLIENT_ID_IOS);
    redirectURI = `${reverseClientId}:/oauth`;
  } else {
    redirectURI = AuthSession.makeRedirectUri({ scheme: 'com.fromfeed.app', path: 'oauth' });
  }

  if (isDevelopment()) {
    console.log('\n[Auth] ========== AUTH DEBUG ==========');
    console.log('[Auth] Platform:', Platform.OS);
    console.log('[Auth] Redirect URI:', redirectURI);
    console.log('[Auth] ================================\n');
  }

  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const codeVerifier = generateBase64url(randomBytes);

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    redirectUri: redirectURI,
    usePKCE: true,
  });

  let code: string;
  let finalCodeVerifier: string | undefined;

  try {
    const result = await request.promptAsync(GOOGLE_DISCOVERY);
    if (isDevelopment()) console.log('[Auth] OAuth result type:', result.type);

    if (result.type !== 'success') {
      return {
        success: false,
        errorCode: 'UNKNOWN',
        errorMessage: result.type === 'cancel' ? 'Connexion annulée' : 'Échec de la connexion OAuth',
      };
    }

    const params = 'params' in result ? result.params : {};
    const { code: oauthCode } = params;

    if (!oauthCode) {
      if (isDevelopment()) console.error('[Auth] Aucun code dans le résultat');
      return { success: false, errorCode: 'UNKNOWN', errorMessage: 'Aucun code OAuth reçu' };
    }

    code = oauthCode;
    const requestWithVerifier = request as AuthSession.AuthRequest & { codeVerifier?: string };
    finalCodeVerifier = requestWithVerifier.codeVerifier ?? codeVerifier;
  } catch (error: unknown) {
    if (isDevelopment()) console.error('[Auth] Erreur dans promptAsync:', error);
    return { success: false, errorCode: 'UNKNOWN', errorMessage: 'Erreur lors de la connexion OAuth' };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/mobile/exchange-oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', code, redirectURI, codeVerifier: finalCodeVerifier }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          errorCode: 'RATE_LIMIT',
          errorMessage: 'Trop de tentatives de connexion. Veuillez patienter quelques instants.',
        };
      }
      return {
        success: false,
        errorCode: response.status >= 500 ? 'NETWORK_ERROR' : 'UNKNOWN',
        errorMessage: 'Erreur lors de la connexion',
      };
    }

    const authSession: AuthSessionData = await response.json();

    if (!authSession.token) {
      if (isDevelopment()) console.error('[Auth] Token not received from backend');
      return { success: false, errorCode: 'INVALID_TOKEN', errorMessage: 'Token invalide reçu du serveur' };
    }

    await storeToken(authSession.token);
    await storeUser(authSession.user);
    await storeExpiresAt(authSession.expiresAt);
    return { success: true, data: authSession };
  } catch (error: unknown) {
    if (isDevelopment()) console.error('[Auth] Erreur échange backend:', error);
    if (error instanceof TypeError && error.message === 'Network request failed') {
      return { success: false, errorCode: 'NETWORK_ERROR', errorMessage: 'Erreur de connexion réseau' };
    }
    return { success: false, errorCode: 'UNKNOWN', errorMessage: 'Erreur lors de la connexion' };
  }
}
