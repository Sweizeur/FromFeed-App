import { create } from 'zustand';
import {
  signInWithGoogle,
  signOut as authSignOut,
  getStoredUser,
  getStoredToken,
  refreshSession,
  type AuthUser,
  type AuthResult,
} from './auth-mobile';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  init: () => Promise<void>;
  signIn: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  isAuthenticated: false,

  init: async () => {
    try {
      const storedUser = await getStoredUser();
      const storedToken = await getStoredToken();

      if (storedUser && storedToken) {
        set({ user: storedUser, token: storedToken, isAuthenticated: true });

        const refreshed = await refreshSession();
        if (refreshed) {
          set({ user: refreshed.user, token: refreshed.token, isAuthenticated: true });
        } else {
          set({ user: null, token: null, isAuthenticated: false });
        }
      }
    } catch (error) {
      __DEV__ && console.error('[Auth] Error loading user:', error);
    } finally {
      set({ loading: false });
    }
  },

  signIn: async () => {
    try {
      const result = await signInWithGoogle();
      if (result.success && result.data) {
        set({
          user: result.data.user,
          token: result.data.token,
          isAuthenticated: true,
        });
      }
      return result;
    } catch (error) {
      __DEV__ && console.error('[Auth] Error signing in:', error);
      return {
        success: false,
        errorCode: 'UNKNOWN' as const,
        errorMessage: 'Erreur lors de la connexion',
      };
    }
  },

  signOut: async () => {
    await authSignOut();
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export function useAuth() {
  return useAuthStore();
}
