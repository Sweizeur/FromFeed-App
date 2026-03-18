import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Vérifie si on est vraiment en mode développement
 * --no-dev désactive certaines fonctionnalités mais __DEV__ peut rester true
 */
const isDevelopment = () => {
  // Vérifier plusieurs indicateurs pour être sûr
  return (
    __DEV__ &&
    process.env.NODE_ENV !== 'production' &&
    !Constants.appOwnership?.includes('expo') &&
    Constants.executionEnvironment !== 'storeClient'
  );
};

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Utiliser le client iOS sur iOS, le client Web ailleurs
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';
const GOOGLE_CLIENT_ID = Platform.OS === 'ios' ? GOOGLE_CLIENT_ID_IOS : GOOGLE_CLIENT_ID_WEB;

/**
 * Génère le reverse client ID (iOS URL Scheme) à partir d'un client ID Google
 * Format: com.googleusercontent.apps.{CLIENT_ID_WITHOUT_SUFFIX}
 * 
 * Le client ID Google est au format: {ID}.apps.googleusercontent.com
 * Le reverse client ID doit être: com.googleusercontent.apps.{ID}
 */
function getReverseClientId(clientId: string): string {
  // Extraire uniquement la partie avant .apps.googleusercontent.com
  // Exemple: 381924267221-cqoc34bs5ll7fougtki6rq909bffhpjc.apps.googleusercontent.com
  // -> 381924267221-cqoc34bs5ll7fougtki6rq909bffhpjc
  const clientIdWithoutSuffix = clientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${clientIdWithoutSuffix}`;
}

// Clés de stockage : SecureStore n'accepte que alphanumériques, ".", "-", "_"
const TOKEN_STORAGE_KEY = 'fromfeed_auth_token'; // Pas de @ ni : pour SecureStore
const USER_STORAGE_KEY = '@fromfeed:user'; // AsyncStorage accepte @ et :

/** Sur iOS, partage du keychain avec la Share Extension (même App Group). */
const SECURE_STORE_IOS_OPTIONS = Platform.OS === 'ios'
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

/**
 * Récupère le token stocké de manière sécurisée
 * Utilise SecureStore (chiffré) au lieu d'AsyncStorage (non chiffré)
 * 
 * Migration automatique : si un token existe dans AsyncStorage (ancien système),
 * il sera migré vers SecureStore et supprimé d'AsyncStorage
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    // Essayer de récupérer depuis SecureStore (groupe partagé iOS pour l’extension)
    const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY, SECURE_STORE_IOS_OPTIONS);
    if (token) {
      return token;
    }

    // Migration iOS : token encore dans le keychain par défaut → copier dans le groupe partagé
    if (Platform.OS === 'ios') {
      const legacyToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY, {});
      if (legacyToken) {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, legacyToken, SECURE_STORE_IOS_OPTIONS);
        return legacyToken;
      }
    }

    // Migration : si pas de token dans SecureStore, vérifier AsyncStorage (ancien système)
    // L'ancienne clé était '@fromfeed:auth_token' (avec @ et :)
    const oldKey = '@fromfeed:auth_token';
    const oldToken = await AsyncStorage.getItem(oldKey);
    if (oldToken) {
      // Migrer vers SecureStore avec la nouvelle clé
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, oldToken, SECURE_STORE_IOS_OPTIONS);
      // Supprimer de l'ancien stockage
      await AsyncStorage.removeItem(oldKey);
      return oldToken;
    }

    return null;
  } catch (error) {
    if (isDevelopment()) {
      console.error('Error retrieving token from SecureStore:', error);
    }
    return null;
  }
}

/**
 * Stocke le token de manière sécurisée
 * Utilise SecureStore (chiffré) au lieu d'AsyncStorage (non chiffré)
 */
export async function storeToken(token: string): Promise<void> {
  if (typeof token !== 'string' || token.length === 0) {
    if (isDevelopment()) {
      console.error('Attempted to store an invalid token:', token);
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token, SECURE_STORE_IOS_OPTIONS);
  } catch (error) {
    if (isDevelopment()) {
      console.error('Error storing token in SecureStore:', error);
    }
  }
}

/**
 * Supprime le token stocké et les données utilisateur
 * Nettoie à la fois SecureStore et AsyncStorage (pour migration)
 */
export async function clearToken(): Promise<void> {
  try {
    // Supprimer le token du SecureStore (nouveau système)
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY, SECURE_STORE_IOS_OPTIONS);
    // Supprimer aussi d'AsyncStorage au cas où (migration/ancien système)
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    // Supprimer les infos utilisateur d'AsyncStorage (non sensibles mais on nettoie tout)
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    if (isDevelopment()) {
      console.error('Error clearing token:', error);
    }
  }
}

/**
 * Récupère l'utilisateur stocké
 */
export async function getStoredUser(): Promise<AuthUser | null> {
  const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
  return userJson ? JSON.parse(userJson) : null;
}

/**
 * Stocke l'utilisateur
 */
export async function storeUser(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

/**
 * Connexion avec Google
 * 
 * Avec un build de développement, on utilise les deep links (com.fromfeed.app:/oauth)
 * avec le client OAuth iOS configuré dans Google Cloud Console.
 * 
 * Retourne un objet AuthResult avec success/errorCode pour permettre de gérer spécifiquement
 * les erreurs comme le rate limit (429).
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!GOOGLE_CLIENT_ID) {
    if (isDevelopment()) {
      console.error('Google Client ID not configured');
    }
    return {
      success: false,
      errorCode: 'UNKNOWN',
      errorMessage: 'Configuration manquante',
    };
  }

  // Configuration OAuth pour Google
  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };

  // Pour iOS, Google utilise le reverse client ID comme schéma d'URL
  // Pour Android/Web, on utilise notre propre schéma
  let redirectURI: string;
  
  if (Platform.OS === 'ios' && GOOGLE_CLIENT_ID_IOS) {
    // iOS : utiliser le reverse client ID comme schéma (requis par Google)
    // Construire manuellement pour éviter les problèmes de formatage avec makeRedirectUri
    const reverseClientId = getReverseClientId(GOOGLE_CLIENT_ID_IOS);
    redirectURI = `${reverseClientId}:/oauth`;
  } else {
    // Android/Web : utiliser notre propre schéma
    redirectURI = AuthSession.makeRedirectUri({
      scheme: 'com.fromfeed.app',
      path: 'oauth',
    });
  }

  if (isDevelopment()) {
    console.log('\n🔐 ========== AUTH DEBUG ==========');
    console.log('🔐 Mode: Deep Links (Development Build)');
    console.log('🔐 Platform:', Platform.OS);
    console.log('🔐 Redirect URI:', redirectURI);
    console.log('🔐 Google Client ID:', GOOGLE_CLIENT_ID);
    if (Platform.OS === 'ios') {
      console.log('🔐 Reverse Client ID:', getReverseClientId(GOOGLE_CLIENT_ID_IOS));
    }
    console.log('🔐 ================================\n');
  }

  // Générer manuellement le code verifier pour PKCE
  // Format: 43-128 caractères aléatoires en base64url
  // Utiliser AuthSession.generateRandom qui génère déjà une chaîne base64url
  // Générer 32 bytes aléatoires et les convertir en base64url
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  
  // Convertir Uint8Array en base64 standard, puis en base64url
  // Utiliser une bibliothèque ou une conversion correcte
  // Pour React Native, on peut utiliser btoa si disponible, sinon conversion manuelle
  let base64 = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let i = 0;
  while (i < randomBytes.length) {
    const a = randomBytes[i++];
    const b = i < randomBytes.length ? randomBytes[i++] : 0;
    const c = i < randomBytes.length ? randomBytes[i++] : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    base64 += chars.charAt((bitmap >> 18) & 63);
    base64 += chars.charAt((bitmap >> 12) & 63);
    base64 += i - 2 < randomBytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    base64 += i - 1 < randomBytes.length ? chars.charAt(bitmap & 63) : '=';
  }
  
  // Convertir en base64url (remplacer +/ par -_ et supprimer =)
  const codeVerifier = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .substring(0, 128);

  if (isDevelopment()) {
    console.log('🔐 Code verifier généré (fallback), longueur:', codeVerifier.length);
    console.log('🔐 Code verifier (premiers 20 chars):', codeVerifier.substring(0, 20));
  }
  
  // Note: expo-auth-session générera automatiquement le code challenge avec usePKCE: true

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    redirectUri: redirectURI,
    usePKCE: true, // Activer PKCE - expo-auth-session générera le code verifier et challenge
  });

  // Lancer le flow OAuth
  if (isDevelopment()) {
    console.log('🔐 Lancement du flow OAuth avec deep links...');
  }

  let code: string;
  let finalCodeVerifier: string | undefined;
  
  try {
    const result = await request.promptAsync(discovery);

    if (isDevelopment()) {
      console.log('🔐 Résultat OAuth type:', result.type);
    }
    
    if (result.type !== 'success') {
      if (isDevelopment()) {
        console.error('🔐 ❌ OAuth échoué - type:', result.type);
      }
      if (result.type === 'cancel') {
        return {
          success: false,
          errorCode: 'UNKNOWN',
          errorMessage: 'Connexion annulée',
        };
      }
      return {
        success: false,
        errorCode: 'UNKNOWN',
        errorMessage: 'Échec de la connexion OAuth',
      };
    }

    // TypeScript: result.type === 'success' garantit que result a une propriété 'params'
    const params = 'params' in result ? result.params : {};
    if (isDevelopment()) {
      console.log('🔐 Résultat params:', JSON.stringify(params, null, 2));
    }
    
    const { code: oauthCode } = params;
    
    if (!oauthCode) {
      if (isDevelopment()) {
        console.error('🔐 ❌ Aucun code dans le résultat');
        console.error('🔐 ❌ Params disponibles:', Object.keys(params));
      }
      return {
        success: false,
        errorCode: 'UNKNOWN',
        errorMessage: 'Aucun code OAuth reçu',
      };
    }
    
    code = oauthCode;

    // Récupérer le code verifier généré par expo-auth-session (non exposé dans les types publics)
    const requestWithVerifier = request as AuthSession.AuthRequest & { codeVerifier?: string };
    finalCodeVerifier = requestWithVerifier.codeVerifier ?? codeVerifier;

    if (isDevelopment()) {
      console.log('🔐 ✅ Code OAuth reçu, longueur:', code.length);
      console.log('🔐 ✅ Code verifier disponible:', !!finalCodeVerifier);
      console.log('🔐 ✅ Code verifier source:', requestWithVerifier.codeVerifier ? 'expo-auth-session' : 'manuel');
      console.log('🔐 Redirect URI à envoyer:', redirectURI);
    }
  } catch (error: unknown) {
    if (isDevelopment()) {
      console.error('🔐 ❌ Erreur dans promptAsync:', error);
      console.error('🔐 ❌ Stack:', error instanceof Error ? error.stack : undefined);
    }
    return {
      success: false,
      errorCode: 'UNKNOWN',
      errorMessage: 'Erreur lors de la connexion OAuth',
    };
  }

  // Échanger le code contre un token de session Better Auth
  // Le backend échange le code OAuth avec Google et crée une session Better Auth
  // redirectURI sera com.fromfeed.app:/oauth
  if (isDevelopment()) {
    console.log('🔐 Envoi du code au backend...');
    console.log('🔐 Backend URL:', BACKEND_URL);
  }
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/mobile/exchange-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
          body: JSON.stringify({
            provider: 'google',
            code,
            redirectURI,
            codeVerifier: finalCodeVerifier, // Envoyer le code verifier PKCE au backend
          }),
    });

    if (isDevelopment()) {
      console.log('🔐 Réponse backend status:', response.status);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      // Ne jamais logger en production, même pour le rate limit
      
      // Détecter le rate limit (429)
      if (response.status === 429) {
        return {
          success: false,
          errorCode: 'RATE_LIMIT',
          errorMessage: 'Trop de tentatives de connexion. Veuillez patienter quelques instants avant de réessayer.',
        };
      }
      
      // Autres erreurs HTTP
      return {
        success: false,
        errorCode: response.status >= 500 ? 'NETWORK_ERROR' : 'UNKNOWN',
        errorMessage: 'Erreur lors de la connexion',
      };
    }
    
        const authSession: AuthSessionData = await response.json();
        // Logs de debug (désactiver en production)
        if (isDevelopment()) {
          console.log('🔐 ✅ Session créée avec succès');
          console.log('🔐 ✅ Token reçu:', authSession.token ? `${authSession.token.substring(0, 20)}...` : 'undefined');
          console.log('🔐 ✅ User reçu:', authSession.user?.email || 'undefined');
        }
    
    // Vérifier que le token est présent
    if (!authSession.token) {
      if (isDevelopment()) {
        console.error('🔐 ❌ Token not received from backend');
      }
      return {
        success: false,
        errorCode: 'INVALID_TOKEN',
        errorMessage: 'Token invalide reçu du serveur',
      };
    }
    
    // Stocker le token et l'utilisateur
    await storeToken(authSession.token);
    await storeUser(authSession.user);
    
    return {
      success: true,
      data: authSession,
    };
  } catch (error: unknown) {
    if (isDevelopment()) {
      console.error('🔐 ❌ Erreur lors de l\'échange avec le backend:', error);
    }

    // Détecter les erreurs réseau
    if (error instanceof TypeError && error.message === 'Network request failed') {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'Erreur de connexion réseau',
      };
    }
    
    return {
      success: false,
      errorCode: 'UNKNOWN',
      errorMessage: 'Erreur lors de la connexion',
    };
  }

}

/**
 * Déconnexion
 */
export async function signOut(): Promise<void> {
  const token = await getStoredToken();
  
  if (token) {
    try {
      await fetch(`${BACKEND_URL}/api/auth/mobile/sign-out`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      if (isDevelopment()) {
        console.error('Error signing out on server:', error);
      }
    }
  }

  await clearToken();
}

/**
 * Rafraîchir la session
 */
export async function refreshSession(): Promise<AuthSessionData | null> {
  const token = await getStoredToken();
  
  if (!token) {
    return null;
  }

  try {
    if (isDevelopment()) {
      console.log('[Auth] Rafraîchissement de la session, URL:', `${BACKEND_URL}/api/auth/mobile/refresh-session`);
    }
    
    // Créer un AbortController pour gérer le timeout (compatible React Native)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes
    
    let response: Response;
    try {
      response = await fetch(`${BACKEND_URL}/api/auth/mobile/refresh-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          // Headers pour ngrok (si nécessaire)
          ...(BACKEND_URL.includes('ngrok') ? {
            'ngrok-skip-browser-warning': 'true',
          } : {}),
        },
        signal: controller.signal,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        if (__DEV__) {
          console.error('[Auth] Request timeout');
        }
        return null;
      }
      if (__DEV__) {
        console.error('[Auth] Network error:', error);
      }
      return null;
    }
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (isDevelopment()) {
        console.warn('[Auth] Session refresh failed, status:', response.status);
      }
      // Session expirée ou invalide
      await clearToken();
      return null;
    }

    const authSession: AuthSessionData = await response.json();
    await storeToken(authSession.token);
    await storeUser(authSession.user);

    return authSession;
  } catch (error) {
    // Gérer les erreurs réseau de manière plus gracieuse
    if (error instanceof TypeError && error.message === 'Network request failed') {
      if (isDevelopment()) {
        console.error('[Auth] Erreur réseau lors du rafraîchissement de la session:', error);
        console.error('[Auth] Backend URL:', BACKEND_URL);
        console.error('[Auth] Vérifiez que le backend est accessible et que ngrok est actif');
      }
      // Ne pas effacer le token en cas d'erreur réseau (l'utilisateur pourrait être hors ligne)
      // Retourner null pour indiquer que la session n'a pas pu être rafraîchie
      return null;
    }
    
    if (isDevelopment()) {
      console.error('[Auth] Erreur lors du rafraîchissement de la session:', error);
    }
    await clearToken();
    return null;
  }
}

/**
 * Vérifier si l'utilisateur est connecté
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null;
}

