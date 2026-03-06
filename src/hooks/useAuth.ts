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
    void Promise.all([secureStorage.getToken(), isSignedIn()]).then(([token, signed]) => {
      if (!mounted) return;
      setState({ token, isLoading: false, isAuthenticated: signed });
    });

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
