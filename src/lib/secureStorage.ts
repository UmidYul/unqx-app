import * as SecureStore from 'expo-secure-store';

const memoryFallback = new Map<string, string>();

function canUseSecureStore(): boolean {
  const api = SecureStore as unknown as Record<string, unknown>;
  return typeof api.getItemAsync === 'function' && typeof api.setItemAsync === 'function';
}

function canUseLocalStorage(): boolean {
  try {
    return typeof globalThis.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export async function storageGetItem(key: string): Promise<string | null> {
  if (canUseSecureStore()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // fallback below
    }
  }

  if (canUseLocalStorage()) {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      // fallback below
    }
  }

  return memoryFallback.get(key) ?? null;
}

export async function storageSetItem(key: string, value: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // fallback below
    }
  }

  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.setItem(key, value);
      return;
    } catch {
      // fallback below
    }
  }

  memoryFallback.set(key, value);
}

export async function storageDeleteItem(key: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch {
      // fallback below
    }
  }

  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.removeItem(key);
      return;
    } catch {
      // fallback below
    }
  }

  memoryFallback.delete(key);
}
