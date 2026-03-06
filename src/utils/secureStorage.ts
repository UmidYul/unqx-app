import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/apiClient';
import { storageDeleteItem, storageGetItem, storageSetItem } from '@/lib/secureStorage';

const REFRESH_TOKEN_KEY = 'unqx.auth.refresh';

export const secureStorage = {
  async getToken(): Promise<string | null> {
    return getAuthToken();
  },

  async setToken(token: string): Promise<void> {
    await setAuthToken(token);
  },

  async getRefreshToken(): Promise<string | null> {
    return storageGetItem(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await storageSetItem(REFRESH_TOKEN_KEY, token);
  },

  async clear(): Promise<void> {
    await clearAuthToken();
    await storageDeleteItem(REFRESH_TOKEN_KEY);
  },
};
