import { useCallback, useEffect, useRef, useState } from 'react';

import { onAuthStateChange } from '@/lib/authStateEmitter';
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

export function setSharedAuthState(nextState: AuthState): void {
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

// Subscribe to auth state changes emitted from authSession.ts (login/logout).
// This runs once at module load time so every component using useAuth reflects
// sign-in / sign-out without needing a full bootstrap round-trip.
onAuthStateChange((signedIn, token) => {
  setSharedAuthState({
    token: token ?? null,
    isLoading: false,
    isAuthenticated: signedIn,
  });
});

export function useAuth() {
  const [state, setState] = useState<AuthState>(sharedAuthState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const listener = (nextState: AuthState) => {
      if (mountedRef.current) {
        setState(nextState);
      }
    };

    listeners.add(listener);
    setState(sharedAuthState);

    if (sharedAuthState.isLoading) {
      void bootstrapSharedAuthState();
    }

    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  const login = useCallback(async (token: string, refreshToken?: string) => {
    await secureStorage.setToken(token);
    if (refreshToken) {
      await secureStorage.setRefreshToken(refreshToken);
    }
    setSharedAuthState({ token, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    await secureStorage.clear();
    setSharedAuthState({ token: null, isLoading: false, isAuthenticated: false });
  }, []);

  return { ...state, login, logout };
}
