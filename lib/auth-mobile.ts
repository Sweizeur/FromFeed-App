import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export interface AuthSessionData {
  token: string;
  user: AuthUser;
  expiresAt: string;
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
    // Essayer de récupérer depuis SecureStore (nouveau système sécurisé)
    const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    if (token) {
      return token;
    }
    
    // Migration : si pas de token dans SecureStore, vérifier AsyncStorage (ancien système)
    // L'ancienne clé était '@fromfeed:auth_token' (avec @ et :)
    const oldKey = '@fromfeed:auth_token';
    const oldToken = await AsyncStorage.getItem(oldKey);
    if (oldToken) {
      // Migrer vers SecureStore avec la nouvelle clé
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, oldToken);
      // Supprimer de l'ancien stockage
      await AsyncStorage.removeItem(oldKey);
      return oldToken;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving token from SecureStore:', error);
    return null;
  }
}

/**
 * Stocke le token de manière sécurisée
 * Utilise SecureStore (chiffré) au lieu d'AsyncStorage (non chiffré)
 */
export async function storeToken(token: string): Promise<void> {
  if (typeof token !== 'string' || token.length === 0) {
    console.error('Attempted to store an invalid token:', token);
    throw new Error('Invalid token provided for storage.');
  }
  try {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
  } catch (error) {
    console.error('Error storing token in SecureStore:', error);
    throw error;
  }
}

/**
 * Supprime le token stocké et les données utilisateur
 * Nettoie à la fois SecureStore et AsyncStorage (pour migration)
 */
export async function clearToken(): Promise<void> {
  try {
    // Supprimer le token du SecureStore (nouveau système)
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    // Supprimer aussi d'AsyncStorage au cas où (migration/ancien système)
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    // Supprimer les infos utilisateur d'AsyncStorage (non sensibles mais on nettoie tout)
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing token:', error);
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
 */
export async function signInWithGoogle(): Promise<AuthSessionData> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Client ID not configured. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS or EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB in .env');
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

  console.log('\n🔐 ========== AUTH DEBUG ==========');
  console.log('🔐 Mode: Deep Links (Development Build)');
  console.log('🔐 Platform:', Platform.OS);
  console.log('🔐 Redirect URI:', redirectURI);
  console.log('🔐 Google Client ID:', GOOGLE_CLIENT_ID);
  if (Platform.OS === 'ios') {
    console.log('🔐 Reverse Client ID:', getReverseClientId(GOOGLE_CLIENT_ID_IOS));
  }
  console.log('🔐 ================================\n');

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

  console.log('🔐 Code verifier généré (fallback), longueur:', codeVerifier.length);
  console.log('🔐 Code verifier (premiers 20 chars):', codeVerifier.substring(0, 20));
  
  // Note: expo-auth-session générera automatiquement le code challenge avec usePKCE: true

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    redirectUri: redirectURI,
    usePKCE: true, // Activer PKCE - expo-auth-session générera le code verifier et challenge
  });

  // Lancer le flow OAuth
  console.log('🔐 Lancement du flow OAuth avec deep links...');

  let code: string;
  let finalCodeVerifier: string | undefined;
  
  try {
    const result = await request.promptAsync(discovery);

    console.log('🔐 Résultat OAuth type:', result.type);
    
    if (result.type !== 'success') {
      console.error('🔐 ❌ OAuth échoué - type:', result.type);
      if (result.type === 'cancel') {
        throw new Error('OAuth cancelled by user');
      }
      throw new Error(`OAuth failed: ${result.type}`);
    }

    // TypeScript: result.type === 'success' garantit que result a une propriété 'params'
    const params = 'params' in result ? result.params : {};
    console.log('🔐 Résultat params:', JSON.stringify(params, null, 2));
    
    const { code: oauthCode } = params;
    
    if (!oauthCode) {
      console.error('🔐 ❌ Aucun code dans le résultat');
      console.error('🔐 ❌ Params disponibles:', Object.keys(params));
      throw new Error('No code received from OAuth');
    }
    
    code = oauthCode;
    
    // Récupérer le code verifier généré par expo-auth-session
    // Si disponible, utiliser celui-là, sinon utiliser le nôtre
    finalCodeVerifier = (request as any).codeVerifier || codeVerifier;
    
    console.log('🔐 ✅ Code OAuth reçu, longueur:', code.length);
    console.log('🔐 ✅ Code verifier disponible:', !!finalCodeVerifier);
    console.log('🔐 ✅ Code verifier source:', (request as any).codeVerifier ? 'expo-auth-session' : 'manuel');
    console.log('🔐 Redirect URI à envoyer:', redirectURI);
  } catch (error: any) {
    console.error('🔐 ❌ Erreur dans promptAsync:', error);
    console.error('🔐 ❌ Stack:', error.stack);
    throw error;
  }

  // Échanger le code contre un token de session Better Auth
  // Le backend échange le code OAuth avec Google et crée une session Better Auth
  // redirectURI sera com.fromfeed.app:/oauth
  console.log('🔐 Envoi du code au backend...');
  console.log('🔐 Backend URL:', BACKEND_URL);
  
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

    console.log('🔐 Réponse backend status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔐 ❌ Erreur backend:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText };
      }
      throw new Error(error.error || `Failed to exchange OAuth code: ${response.status}`);
    }
    
        const authSession: AuthSessionData = await response.json();
        // Logs de debug (désactiver en production)
        if (__DEV__) {
          console.log('🔐 ✅ Session créée avec succès');
          console.log('🔐 ✅ Token reçu:', authSession.token ? `${authSession.token.substring(0, 20)}...` : 'undefined');
          console.log('🔐 ✅ User reçu:', authSession.user?.email || 'undefined');
        }
    
    // Vérifier que le token est présent
    if (!authSession.token) {
      throw new Error('Token not received from backend');
    }
    
    // Stocker le token et l'utilisateur
    await storeToken(authSession.token);
    await storeUser(authSession.user);
    
    return authSession;
  } catch (error: any) {
    console.error('🔐 ❌ Erreur lors de l\'échange avec le backend:', error);
    throw error;
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
      console.error('Error signing out on server:', error);
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

  const response = await fetch(`${BACKEND_URL}/api/auth/mobile/refresh-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // Session expirée ou invalide
    await clearToken();
    return null;
  }

  const authSession: AuthSessionData = await response.json();
  await storeToken(authSession.token);
  await storeUser(authSession.user);

  return authSession;
}

/**
 * Vérifier si l'utilisateur est connecté
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null;
}

