import * as SecureStore from 'expo-secure-store';

import { addSentryBreadcrumb } from '@/lib/sentry';

const memoryFallback = new Map<string, string>();
const insecureStorageSignals = new Set<string>();

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

function envEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isSensitiveStorageKey(key: string): boolean {
  const normalized = String(key ?? '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith('unqx.auth.')) {
    return true;
  }
  return normalized.includes('token') || normalized.includes('jwt');
}

function reportInsecureStorageUsage(key: string, allowed: boolean): void {
  const sensitive = isSensitiveStorageKey(key);
  if (!sensitive) {
    return;
  }

  const eventKey = `${allowed ? 'allow' : 'block'}:${key}`;
  if (insecureStorageSignals.has(eventKey)) {
    return;
  }
  insecureStorageSignals.add(eventKey);

  addSentryBreadcrumb({
    category: 'security',
    level: allowed ? 'warning' : 'info',
    message: allowed
      ? 'Insecure localStorage fallback enabled for auth key'
      : 'Insecure localStorage fallback blocked for auth key',
    data: {
      key,
      allowed,
    },
  });
}

function canUseLocalStorageForKey(key: string): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }

  const sensitive = isSensitiveStorageKey(key);
  if (!sensitive) {
    const disabled = process.env.EXPO_PUBLIC_ALLOW_INSECURE_STORAGE;
    return !disabled || disabled.trim().toLowerCase() !== 'false';
  }

  const allowed = envEnabled(process.env.EXPO_PUBLIC_ALLOW_INSECURE_AUTH_STORAGE);
  reportInsecureStorageUsage(key, allowed);
  return allowed;
}

export async function storageGetItem(key: string): Promise<string | null> {
  if (canUseSecureStore()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // fallback below
    }
  }

  if (canUseLocalStorageForKey(key)) {
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

  if (canUseLocalStorageForKey(key)) {
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

  const allowLocalStorage = canUseLocalStorageForKey(key);
  const shouldForceCleanup = !allowLocalStorage && isSensitiveStorageKey(key) && canUseLocalStorage();
  if (allowLocalStorage || shouldForceCleanup) {
    try {
      globalThis.localStorage.removeItem(key);
      return;
    } catch {
      // fallback below
    }
  }

  memoryFallback.delete(key);
}
