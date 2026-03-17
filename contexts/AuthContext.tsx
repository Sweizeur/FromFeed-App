import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signInWithGoogle,
  signOut as authSignOut,
  getStoredUser,
  getStoredToken,
  refreshSession,
  type AuthUser,
  type AuthResult,
} from '@/lib/auth-mobile';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await getStoredUser();
        const storedToken = await getStoredToken();

        if (storedUser && storedToken) {
          setUser(storedUser);
          setToken(storedToken);

          const refreshed = await refreshSession();
          if (refreshed) {
            setUser(refreshed.user);
            setToken(refreshed.token);
          } else {
            setUser(null);
            setToken(null);
          }
        }
      } catch (error) {
        __DEV__ && console.error('[Auth] Error loading user:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (): Promise<AuthResult> => {
    try {
      const result = await signInWithGoogle();
      if (result.success && result.data) {
        setUser(result.data.user);
        setToken(result.data.token);
      }
      return result;
    } catch (error) {
      __DEV__ && console.error('[Auth] Error signing in:', error);
      return {
        success: false,
        errorCode: 'UNKNOWN',
        errorMessage: 'Erreur lors de la connexion',
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: user !== null,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
