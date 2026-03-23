import { ApiError as ApiErrorShape } from '@/types';
import { storageDeleteItem, storageGetItem, storageSetItem } from '@/lib/secureStorage';
import { addSentryBreadcrumb, captureSentryException } from '@/lib/sentry';
import { extractSlug } from '@/utils/links';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://unqx.uz/api';
const TOKEN_KEY = 'unqx.auth.bearer';
const REFRESH_TOKEN_KEY = 'unqx.auth.refresh';
const CSRF_BOOTSTRAP_PATH = '/auth/me';

export class ApiError extends Error implements ApiErrorShape {
  status: number;
  code: string | null;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    status: number,
    code: string | null,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ApiQueryValue = string | number | boolean | null | undefined;
export type ApiBody = object | Array<unknown> | string | number | boolean | null;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, ApiQueryValue>;
  body?: ApiBody;
}

let authTokenCache: string | null = null;
let csrfTokenCache: string | null = null;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildQuery(query?: Record<string, ApiQueryValue>): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function buildUrl(path: string, query?: Record<string, ApiQueryValue>): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeBaseUrl(API_BASE_URL)}${cleanPath}${buildQuery(query)}`;
}

function isJsonResponse(contentType: string | null): boolean {
  return !!contentType && contentType.includes('application/json');
}

function isWafBlockedPayload(payload: unknown): payload is { message: string } {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const message = typeof (payload as Record<string, unknown>).message === 'string'
    ? String((payload as Record<string, unknown>).message)
    : '';
  return /access denied by imunify360/i.test(message);
}

function canFallback(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

function isRawBody(value: unknown): value is BodyInit {
  if (value instanceof FormData) return true;
  if (value instanceof URLSearchParams) return true;
  if (value instanceof Blob) return true;
  if (value instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(value)) return true;
  return false;
}

function isWriteMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

async function ensureCsrfToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && csrfTokenCache) {
    return csrfTokenCache;
  }

  try {
    const response = await fetch(buildUrl(CSRF_BOOTSTRAP_PATH), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as { csrfToken?: unknown } | null;
    const token = typeof payload?.csrfToken === 'string' ? payload.csrfToken.trim() : '';
    if (!token) {
      return null;
    }

    csrfTokenCache = token;
    return token;
  } catch {
    return null;
  }
}

async function parseApiError(response: Response, endpoint: string, method: string): Promise<never> {
  const contentType = response.headers.get('content-type');
  addSentryBreadcrumb({
    category: 'api',
    level: 'error',
    message: `API error: ${method} ${endpoint} (${response.status})`,
  });

  if (isJsonResponse(contentType)) {
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const message = typeof payload?.error === 'string'
      ? payload.error
      : (typeof payload?.message === 'string' ? payload.message : 'Request failed');
    const code = typeof payload?.code === 'string' ? payload.code : null;
    throw new ApiError(message, response.status, code, payload);
  }

  const text = await response.text().catch(() => null);
  throw new ApiError(text || response.statusText || 'Request failed', response.status, null);
}

async function resolveAuthToken(): Promise<string | null> {
  if (authTokenCache !== null) {
    return authTokenCache;
  }

  try {
    authTokenCache = await storageGetItem(TOKEN_KEY);
    return authTokenCache;
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  authTokenCache = token;
  await storageSetItem(TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  authTokenCache = null;
  await storageDeleteItem(TOKEN_KEY);
}

export async function getAuthToken(): Promise<string | null> {
  return resolveAuthToken();
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(options.headers || {});
  const token = await resolveAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (isWriteMethod(method) && !headers.has('x-csrf-token')) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (isRawBody(options.body)) {
      body = options.body;
    } else if (typeof options.body === 'string') {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'text/plain;charset=UTF-8');
      }
      body = options.body;
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      body = JSON.stringify(options.body);
    }
  }

  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(buildUrl(path, options.query), {
        ...options,
        method,
        headers,
        credentials: options.credentials ?? 'include',
        body,
      });
    } catch (error) {
      addSentryBreadcrumb({
        category: 'api',
        level: 'error',
        message: `API error: ${method} ${endpoint} (network)`,
      });
      captureSentryException(error, {
        tags: { endpoint, method },
      });
      throw error;
    }

    if (
      response.status === 403 &&
      attempt === 0 &&
      isWriteMethod(method)
    ) {
      const refreshed = await ensureCsrfToken(true);
      if (refreshed) {
        headers.set('x-csrf-token', refreshed);
        continue;
      }
    }

    break;
  }

  if (!response) {
    throw new ApiError('Request failed', 500, null);
  }

  if (!response.ok) {
    if (response.status === 401) {
      authTokenCache = null;
      await storageDeleteItem(TOKEN_KEY).catch(() => undefined);
      await storageDeleteItem(REFRESH_TOKEN_KEY).catch(() => undefined);
    }
    const error = await parseApiError(response, endpoint, method).catch((e) => e);
    captureSentryException(error, {
      tags: { endpoint, method },
    });
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (!isJsonResponse(contentType)) {
    return (await response.text()) as T;
  }

  const payload = (await response.json()) as unknown;
  if (isWafBlockedPayload(payload)) {
    throw new ApiError(payload.message, 403, 'WAF_BLOCKED', payload as Record<string, unknown>);
  }
  return payload as T;
}

async function requestFirst<T>(
  method: string,
  paths: string[],
  bodyOrOptions?: ApiBody | Omit<RequestOptions, 'body'>,
  maybeOptions?: Omit<RequestOptions, 'body'>,
): Promise<T> {
  const normalized = paths.filter(Boolean);
  if (normalized.length === 0) {
    throw new ApiError('No API path provided', 500, 'NO_PATH');
  }

  const body = method === 'GET' || method === 'DELETE' ? undefined : (bodyOrOptions as ApiBody | undefined);
  const options =
    method === 'GET' || method === 'DELETE'
      ? ((bodyOrOptions as Omit<RequestOptions, 'body'>) ?? {})
      : (maybeOptions ?? {});

  let lastError: unknown = null;
  for (const path of normalized) {
    try {
      return await request<T>(method, path, { ...options, body });
    } catch (error) {
      lastError = error;
      if (!canFallback(error)) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new ApiError('Request failed', 500, null);
}

export const apiClient = {
  get: <T>(path: string, options: Omit<RequestOptions, 'body'> = {}) => request<T>('GET', path, options),
  post: <T>(path: string, body?: ApiBody, options: Omit<RequestOptions, 'body'> = {}) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: ApiBody, options: Omit<RequestOptions, 'body'> = {}) =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: ApiBody, options: Omit<RequestOptions, 'body'> = {}) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options: Omit<RequestOptions, 'body'> = {}) => request<T>('DELETE', path, options),
  getFirst: <T>(paths: string[], options: Omit<RequestOptions, 'body'> = {}) =>
    requestFirst<T>('GET', paths, options),
  postFirst: <T>(paths: string[], body?: ApiBody, options: Omit<RequestOptions, 'body'> = {}) =>
    requestFirst<T>('POST', paths, body, options),
  putFirst: <T>(paths: string[], body?: ApiBody, options: Omit<RequestOptions, 'body'> = {}) =>
    requestFirst<T>('PUT', paths, body, options),
  patchFirst: <T>(paths: string[], body?: ApiBody, options: Omit<RequestOptions, 'body'> = {}) =>
    requestFirst<T>('PATCH', paths, body, options),
  deleteFirst: <T>(paths: string[], options: Omit<RequestOptions, 'body'> = {}) =>
    requestFirst<T>('DELETE', paths, options),
};

export interface NfcScanPayload {
  uid?: string;
  url?: string;
  recordTap?: boolean;
}

export interface NfcWritePayload {
  url: string;
  uid?: string;
}

export interface NfcLockPayload {
  password: string;
  uid?: string;
}

function shouldTryNextDeleteVariant(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  // Auth/permission failures should fail fast.
  if (error.status === 401 || error.status === 403) {
    return false;
  }

  // For delete, backends can vary by method/path/payload; try next variant.
  return true;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function logCardView(slug: string, source: string): Promise<void> {
  await apiClient
    .post(`/cards/${encodeURIComponent(slug)}/view`, { src: source })
    .catch(() => undefined);
}

export const nfcApi = {
  scan: async (payload: NfcScanPayload) => {
    const slug = extractSlug(payload.url ?? '');
    await apiClient.post('/nfc/scan', { ...payload, recordTap: false });
    if (slug) {
      await apiClient.post('/nfc/tap', { ownerSlug: slug, source: 'nfc' }).catch(async () => {
        await logCardView(slug, 'nfc');
      });
    }
    return { ok: true };
  },
  write: async (payload: NfcWritePayload) => {
    const slug = extractSlug(payload.url);
    await apiClient.post('/nfc/write', payload).catch(async () => {
      if (slug) {
        await logCardView(slug, 'nfc');
      }
      throw new ApiError('Failed to write NFC data', 0, 'NFC_WRITE_FAILED');
    });
    return { ok: true };
  },
  lock: async (payload: NfcLockPayload) => {
    await apiClient.post('/nfc/lock', payload);
    return { ok: true };
  },
  history: async () => {
    const server = await apiClient.get<{ items?: Array<any> }>('/nfc/history');
    const normalized = Array.isArray(server?.items)
      ? server.items
        .map((item: any, index: number) => {
          const byUrl = extractSlug(item?.url ?? '');
          const bySlug = extractSlug(item?.slug ?? '');
          const looksLikePlaceholderSlug = bySlug === 'UNQ000' && !byUrl;
          const slug = looksLikePlaceholderSlug ? '' : byUrl ?? bySlug ?? '';
          const type = String(item?.type ?? '').toLowerCase();
          const safeType = type === 'write' || type === 'verify' || type === 'lock' || type === 'read' ? type : 'read';
          const timestamp = String(item?.timestamp ?? item?.createdAt ?? '');

          return {
            id: String(item?.id ?? `h-${index}`),
            slug,
            uid: item?.uid ? String(item.uid) : undefined,
            type: safeType,
            timestamp,
          };
        })
        .filter((item: any) => Boolean(item.slug || item.uid || item.timestamp))
      : [];
    return { items: normalized };
  },
  tags: async () => {
    const server = await apiClient.get<{ items?: Array<any> }>('/nfc/tags');
    const normalized = Array.isArray(server?.items)
      ? server.items
        .map((item: any) => {
          const uid = String(item?.uid ?? '').trim();
          const rawName = String(item?.name ?? '').trim();
          const looksLikePlaceholderName = rawName.toLowerCase() === 'метка' || rawName.toLowerCase() === 'tag';
          const name = !rawName || looksLikePlaceholderName ? uid : rawName;

          return {
            uid,
            name,
            linkedSlug: extractSlug(item?.linkedSlug ?? '') ?? item?.linkedSlug ?? undefined,
            status: item?.status ? String(item.status) : undefined,
            updatedAt: String(item?.updatedAt ?? item?.lastTapAt ?? ''),
          };
        })
        .filter((item: any) => Boolean(item.uid))
      : [];
    return { items: normalized };
  },
  renameTag: async (uid: string, name: string) => {
    const cleanUid = String(uid).trim();
    const cleanName = String(name).trim();
    if (!cleanUid || !cleanName) {
      throw new ApiError('Tag uid and name are required', 400, 'VALIDATION_ERROR');
    }

    await apiClient.patch(`/nfc/tags/${encodeURIComponent(cleanUid)}`, { name: cleanName });
    return { ok: true };
  },
  deleteTag: async (uid: string) => {
    const cleanUid = String(uid).trim();
    if (!cleanUid) {
      throw new ApiError('Tag uid is required', 400, 'VALIDATION_ERROR');
    }

    const encodedUid = encodeURIComponent(cleanUid);
    const deleteVariants: Array<() => Promise<unknown>> = [
      () => apiClient.delete(`/nfc/tags/${encodedUid}`),
      () => apiClient.delete('/nfc/tags', { query: { uid: cleanUid } }),
    ];

    let lastError: unknown = null;
    for (const runVariant of deleteVariants) {
      try {
        await runVariant();
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!shouldTryNextDeleteVariant(error)) {
          throw error;
        }
      }
    }

    if (lastError) {
      if (lastError instanceof Error) {
        throw lastError;
      }
      throw new ApiError('Failed to delete tag', 500, 'NFC_TAG_DELETE_FAILED');
    }

    // Confirm eventual consistency: some backends apply deletion asynchronously.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const latest = await nfcApi.tags().catch(() => ({ items: [] as Array<{ uid: string }> }));
      const stillExists = Array.isArray(latest?.items)
        ? latest.items.some((item: any) => String(item?.uid ?? '') === cleanUid)
        : false;

      if (!stillExists) {
        return { ok: true };
      }

      await wait(220 * (attempt + 1));
    }

    throw new ApiError('Tag deletion was not confirmed', 409, 'NFC_TAG_DELETE_NOT_CONFIRMED');
  },
  clearLocalData: async () => {
    // Kept for backward compatibility. NFC no longer stores local cache.
    return { ok: true };
  },
  markVerified: async (payload: { uid?: string; url?: string }) => {
    await apiClient.post('/nfc/verify', payload);
    return { ok: true };
  },
};
