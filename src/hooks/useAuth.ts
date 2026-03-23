import { useCallback, useEffect, useState } from 'react';

import { secureStorage } from '@/utils/secureStorage';
import { isSignedIn } from '@/services/authSession';

interface AuthState {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      let token: string | null = null;
      let signed = false;
      try {
        [token, signed] = await Promise.all([secureStorage.getToken(), isSignedIn()]);
      } catch {
        token = null;
        signed = false;
      } finally {
        if (!mounted) return;
        setState({ token, isLoading: false, isAuthenticated: signed });
      }
    };
    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (token: string, refreshToken: string) => {
    await secureStorage.setToken(token);
    await secureStorage.setRefreshToken(refreshToken);
    setState({ token, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    await secureStorage.clear();
    setState({ token: null, isLoading: false, isAuthenticated: false });
  }, []);

  return { ...state, login, logout };
}
