import { ApiError, apiClient as coreApiClient, RequestOptions } from '@/lib/apiClient';
import { secureStorage } from '@/utils/secureStorage';

function toOptions(options?: RequestInit): Omit<RequestOptions, 'body'> {
  return {
    headers: options?.headers,
    credentials: options?.credentials,
    mode: options?.mode,
    cache: options?.cache,
    redirect: options?.redirect,
    referrer: options?.referrer,
    referrerPolicy: options?.referrerPolicy,
    keepalive: options?.keepalive,
    signal: options?.signal,
  };
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await secureStorage.clear();
      throw new Error('UNAUTHORIZED');
    }
    throw error;
  }
}

export const apiClient = {
  get: <T>(url: string, options?: RequestInit) =>
    wrap(() => coreApiClient.get<T>(url, toOptions(options))),
  post: <T>(url: string, body: unknown, options?: RequestInit) =>
    wrap(() => coreApiClient.post<T>(url, body as RequestOptions['body'], toOptions(options))),
  patch: <T>(url: string, body: unknown, options?: RequestInit) =>
    wrap(() => coreApiClient.patch<T>(url, body as RequestOptions['body'], toOptions(options))),
  delete: <T>(url: string, options?: RequestInit) =>
    wrap(() => coreApiClient.delete<T>(url, toOptions(options))),
};
