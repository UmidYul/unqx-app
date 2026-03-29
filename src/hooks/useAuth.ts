import { useCallback, useEffect, useState } from 'react';

import { secureStorage } from '@/utils/secureStorage';
import { isSignedIn } from '@/services/authSession';

interface AuthState {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

let sharedAuthState: AuthState = {
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

let bootstrapPromise: Promise<void> | null = null;
const listeners = new Set<(state: AuthState) => void>();

function emitAuthState(): void {
  for (const listener of listeners) {
    listener(sharedAuthState);
  }
}

function setSharedAuthState(nextState: AuthState): void {
  sharedAuthState = nextState;
  emitAuthState();
}

async function bootstrapSharedAuthState(): Promise<void> {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    let token: string | null = null;
    let signed = false;

    try {
      // Keep auth bootstrap strictly sequential to avoid token/read races:
      // if secure storage intermittently fails in one parallel branch, we can
      // end up with signed=true and token=null (cookie fallback), which may
      // surface another account.
      signed = await isSignedIn();
      token = signed ? await secureStorage.getToken() : null;
      if (signed && !token) {
        signed = false;
      }
    } catch {
      token = null;
      signed = false;
    }

    setSharedAuthState({
      token,
      isLoading: false,
      isAuthenticated: signed,
    });
  })();

  try {
    await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(sharedAuthState);

  useEffect(() => {
    const listener = (nextState: AuthState) => {
      setState(nextState);
    };

    listeners.add(listener);
    setState(sharedAuthState);

    if (sharedAuthState.isLoading) {
      void bootstrapSharedAuthState();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const login = useCallback(async (token: string, refreshToken: string) => {
    await secureStorage.setToken(token);
    await secureStorage.setRefreshToken(refreshToken);
    setSharedAuthState({ token, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    await secureStorage.clear();
    setSharedAuthState({ token: null, isLoading: false, isAuthenticated: false });
  }, []);

  return { ...state, login, logout };
}
