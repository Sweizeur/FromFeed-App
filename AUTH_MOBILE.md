# 🔐 Authentification Mobile - React Native/Expo

Ce guide explique comment intégrer l'authentification Google (et Apple plus tard) dans votre application mobile React Native/Expo.

## 📋 Prérequis

1. **Expo SDK 50+** (recommandé)
2. **expo-auth-session** pour OAuth
3. **expo-crypto** pour la génération de codes
4. **@react-native-async-storage/async-storage** pour stocker le token

## 🚀 Installation

```bash
cd fromfeed-app
npx expo install expo-auth-session expo-crypto @react-native-async-storage/async-storage
```

## ⚙️ Configuration

### 1. Configuration Google Cloud Console

Pour l'authentification mobile, vous devez configurer des **redirect URIs spécifiques** dans Google Cloud Console :

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet OAuth
3. Allez dans **APIs & Services** > **Credentials**
4. Cliquez sur votre **OAuth 2.0 Client ID**
5. Ajoutez ces **Authorized redirect URIs** :
   - `com.fromfeed.app:/oauth` (pour Android)
   - `com.fromfeed.app:/oauth` (pour iOS - même format)
   - `exp://localhost:8081/--/oauth` (pour Expo Go en développement)

### 2. Configuration Expo (app.json)

```json
{
  "expo": {
    "scheme": "com.fromfeed.app",
    "ios": {
      "bundleIdentifier": "com.fromfeed.app"
    },
    "android": {
      "package": "com.fromfeed.app"
    }
  }
}
```

### 3. Variables d'environnement

Créez un fichier `.env` dans `fromfeed-app/` :

```env
EXPO_PUBLIC_BACKEND_URL=https://your-backend.railway.app
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

## 📱 Code d'authentification

### 1. Client d'authentification (`lib/auth-mobile.ts`)

```typescript
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';

const TOKEN_STORAGE_KEY = '@fromfeed:auth_token';
const USER_STORAGE_KEY = '@fromfeed:user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

/**
 * Récupère le token stocké
 */
export async function getStoredToken(): Promise<string | null> {
  return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Stocke le token
 */
export async function storeToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/**
 * Supprime le token stocké
 */
export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  await AsyncStorage.removeItem(USER_STORAGE_KEY);
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
 */
export async function signInWithGoogle(): Promise<AuthSession> {
  // Générer un code verifier pour PKCE (sécurité)
  const codeVerifier = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Math.random().toString(),
    { encoding: Crypto.CryptoEncoding.BASE64URL }
  );

  // Configuration OAuth pour Google
  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };

  const redirectURI = AuthSession.makeRedirectUri({
    scheme: 'com.fromfeed.app',
    path: 'oauth',
  });

  // Créer la requête d'autorisation
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    redirectUri: redirectURI,
    codeChallenge: codeVerifier,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
  });

  // Lancer le flow OAuth
  const result = await request.promptAsync(discovery, {
    useProxy: false, // Utiliser le navigateur système, pas le proxy Expo
  });

  if (result.type !== 'success') {
    throw new Error('OAuth cancelled or failed');
  }

  const { code } = result.params;

  // Échanger le code contre un token de session Better Auth
  const response = await fetch(`${BACKEND_URL}/api/auth/mobile/exchange-oauth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: 'google',
      code,
      redirectURI,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to exchange OAuth code');
  }

  const authSession: AuthSession = await response.json();

  // Stocker le token et l'utilisateur
  await storeToken(authSession.token);
  await storeUser(authSession.user);

  return authSession;
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
export async function refreshSession(): Promise<AuthSession | null> {
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

  const authSession: AuthSession = await response.json();
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
```

### 2. Hook React (`hooks/useAuth.ts`)

```typescript
import { useState, useEffect } from 'react';
import {
  signInWithGoogle,
  signOut,
  getStoredUser,
  getStoredToken,
  refreshSession,
  type AuthUser,
} from '../lib/auth-mobile';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const storedUser = await getStoredUser();
      const storedToken = await getStoredToken();

      if (storedUser && storedToken) {
        setUser(storedUser);
        setToken(storedToken);
        
        // Vérifier et rafraîchir la session si nécessaire
        const refreshed = await refreshSession();
        if (refreshed) {
          setUser(refreshed.user);
          setToken(refreshed.token);
        } else {
          // Session expirée
          setUser(null);
          setToken(null);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    try {
      const session = await signInWithGoogle();
      setUser(session.user);
      setToken(session.token);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setToken(null);
  }

  return {
    user,
    token,
    loading,
    signIn: handleSignIn,
    signOut: handleSignOut,
    isAuthenticated: user !== null,
  };
}
```

### 3. Utilisation dans un composant

```typescript
import { View, Button, Text } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export default function LoginScreen() {
  const { user, loading, signIn, signOut, isAuthenticated } = useAuth();

  if (loading) {
    return <Text>Chargement...</Text>;
  }

  if (isAuthenticated) {
    return (
      <View>
        <Text>Connecté en tant que {user?.name}</Text>
        <Text>{user?.email}</Text>
        <Button title="Déconnexion" onPress={signOut} />
      </View>
    );
  }

  return (
    <View>
      <Button title="Se connecter avec Google" onPress={signIn} />
    </View>
  );
}
```

### 4. Utilisation du token dans les appels API

```typescript
import { getStoredToken } from './lib/auth-mobile';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = await getStoredToken();
  
  return fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });
}
```

## 🍎 Authentification Apple (plus tard)

L'authentification Apple nécessite :
1. Un compte développeur Apple payant ($99/an)
2. Configuration dans Apple Developer Console
3. Utilisation de `expo-apple-authentication`

Le code sera similaire à Google, mais avec `provider: 'apple'` dans l'appel à `/api/auth/mobile/exchange-oauth`.

## 📞 Authentification par téléphone (plus tard)

L'authentification par SMS nécessite un service payant comme :
- **Twilio** (~$0.0075 par SMS)
- **Firebase Auth** (gratuit jusqu'à 10k SMS/mois)
- **AWS SNS** (~$0.00645 par SMS)

Better Auth supporte l'authentification par téléphone, mais il faudra configurer un provider SMS.

## ✅ Résumé

1. ✅ **Backend** : Routes `/api/auth/mobile/*` créées
2. ✅ **Middleware** : Support des tokens Bearer ajouté
3. 📱 **Mobile** : Code d'exemple fourni ci-dessus
4. ⚙️ **Configuration** : Google Cloud Console à configurer

Le backend est prêt ! Il ne reste plus qu'à :
1. Installer les dépendances Expo
2. Copier le code dans votre app
3. Configurer les redirect URIs dans Google Cloud Console
4. Tester !

