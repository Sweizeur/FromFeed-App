import { useState, useEffect } from 'react';
import {
  signInWithGoogle,
  signOut,
  getStoredUser,
  getStoredToken,
  refreshSession,
  type AuthUser,
  type AuthResult,
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
      __DEV__ && console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(): Promise<AuthResult> {
    try {
      const result = await signInWithGoogle();
      if (result.success && result.data) {
        setUser(result.data.user);
        setToken(result.data.token);
      }
      return result;
    } catch (error) {
      __DEV__ && console.error('Error signing in:', error);
      return {
        success: false,
        errorCode: 'UNKNOWN',
        errorMessage: 'Erreur lors de la connexion',
      };
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

