import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const FIVE_MINUTES = 1000 * 60 * 5;
const DAY_MS = 1000 * 60 * 60 * 24;
const memoryFallback = new Map<string, string>();

let asyncStorageUnavailableLogged = false;

function logAsyncStorageUnavailable(error: unknown): void {
  if (asyncStorageUnavailableLogged) {
    return;
  }
  asyncStorageUnavailableLogged = true;
  if (__DEV__) {
    console.log('[UNQX] AsyncStorage unavailable for React Query persist, using in-memory fallback.', error);
  }
}

const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      logAsyncStorageUnavailable(error);
      return memoryFallback.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      logAsyncStorageUnavailable(error);
      memoryFallback.set(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logAsyncStorageUnavailable(error);
      memoryFallback.delete(key);
    }
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES,
      gcTime: DAY_MS,
      networkMode: 'offlineFirst',
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: safeStorage,
  key: 'UNQX_RQ_CACHE_V1',
});

export const queryPersistMaxAge = DAY_MS;
