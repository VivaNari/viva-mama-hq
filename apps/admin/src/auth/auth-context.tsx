import type { AdminProfile } from 'src/api/admin';

import { useState, useEffect, useContext, useCallback, createContext } from 'react';

import { getStoredToken, setStoredToken, clearStoredToken } from 'src/utils/axios';

import { getMe, login as loginRequest } from 'src/api/admin';

// ----------------------------------------------------------------------

type AuthContextValue = {
  admin: AdminProfile | null;
  /** True until the stored token has been validated against the server. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

// ----------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      if (!getStoredToken()) {
        setLoading(false);
        return;
      }

      // A token in localStorage proves nothing — it may be expired, or belong to an
      // account that has since been demoted. Ask the server before trusting it.
      try {
        const profile = await getMe();
        if (active) {
          setAdmin(profile);
        }
      } catch {
        clearStoredToken();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    restore();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    setStoredToken(result.token);
    setAdmin(result.admin);
  }, []);

  const signOut = useCallback(() => {
    clearStoredToken();
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
