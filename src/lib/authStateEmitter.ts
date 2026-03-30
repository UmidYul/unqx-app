type AuthStateListener = (signedIn: boolean, token: string | null) => void;

const listeners = new Set<AuthStateListener>();

export function onAuthStateChange(listener: AuthStateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAuthSignedIn(token: string | null): void {
  for (const listener of listeners) {
    listener(true, token);
  }
}

export function emitAuthSignedOut(): void {
  for (const listener of listeners) {
    listener(false, null);
  }
}
