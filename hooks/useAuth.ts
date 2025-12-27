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
      // Utiliser le proxy en développement, deep links en production
      const useProxy = process.env.EXPO_PUBLIC_USE_PROXY === 'true';
      const session = await signInWithGoogle(useProxy);
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

