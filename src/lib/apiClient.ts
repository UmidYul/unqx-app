import { ApiError as ApiErrorShape } from '@/types';
import { storageDeleteItem, storageGetItem, storageSetItem } from '@/lib/secureStorage';
import { addSentryBreadcrumb, captureSentryException } from '@/lib/sentry';
import { extractSlug } from '@/utils/links';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://unqx.uz/api';
const TOKEN_KEY = 'unqx.auth.bearer';
const REFRESH_TOKEN_KEY = 'unqx.auth.refresh';
const CSRF_BOOTSTRAP_PATH = '/login';

export class ApiError extends Error implements ApiErrorShape {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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

function resolveAppOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return 'https://unqx.uz';
  }
}

const APP_ORIGIN = resolveAppOrigin(API_BASE_URL);

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

function parseCsrfTokenFromHtml(html: string): string | null {
  if (!html) {
    return null;
  }

  const patterns = [
    /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']csrf-token["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function ensureCsrfToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && csrfTokenCache) {
    return csrfTokenCache;
  }

  try {
    const response = await fetch(`${APP_ORIGIN}${CSRF_BOOTSTRAP_PATH}`, {
      method: 'GET',
      headers: {
        Accept: 'text/html',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const token = parseCsrfTokenFromHtml(html);
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
    const payload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    throw new ApiError(payload?.error ?? 'Request failed', response.status, payload?.code ?? null);
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

  return (await response.json()) as T;
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

type NfcHistoryType = 'read' | 'write' | 'verify' | 'lock';

interface LocalNfcHistoryItem {
  id: string;
  slug: string;
  uid?: string;
  type: NfcHistoryType;
  timestamp: string;
}

interface LocalNfcTagItem {
  uid: string;
  name: string;
  linkedSlug?: string;
  status?: string;
  updatedAt: string;
}

const NFC_HISTORY_KEY = 'unqx.nfc.history.v1';
const NFC_TAGS_KEY = 'unqx.nfc.tags.v1';

async function readLocalArray<T>(key: string): Promise<T[]> {
  const raw = await storageGetItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeLocalArray<T>(key: string, items: T[]): Promise<void> {
  await storageSetItem(key, JSON.stringify(items));
}

async function appendLocalHistory(item: Omit<LocalNfcHistoryItem, 'id' | 'timestamp'>): Promise<void> {
  const current = await readLocalArray<LocalNfcHistoryItem>(NFC_HISTORY_KEY);
  const next: LocalNfcHistoryItem = {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    slug: item.slug,
    uid: item.uid,
    type: item.type,
    timestamp: new Date().toISOString(),
  };

  const merged = [next, ...current].slice(0, 80);
  await writeLocalArray(NFC_HISTORY_KEY, merged);
}

async function upsertLocalTag(uid?: string, linkedSlug?: string): Promise<void> {
  const cleanUid = String(uid ?? '').trim();
  if (!cleanUid) {
    return;
  }

  const current = await readLocalArray<LocalNfcTagItem>(NFC_TAGS_KEY);
  const existing = current.find((item) => item.uid === cleanUid);

  if (existing) {
    existing.linkedSlug = linkedSlug ?? existing.linkedSlug;
    existing.updatedAt = new Date().toISOString();
  } else {
    current.unshift({
      uid: cleanUid,
      name: `Tag ${cleanUid.slice(-4).toUpperCase()}`,
      linkedSlug,
      status: 'active',
      updatedAt: new Date().toISOString(),
    });
  }

  await writeLocalArray(NFC_TAGS_KEY, current.slice(0, 40));
}

async function logCardView(slug: string, source: string): Promise<void> {
  await apiClient
    .post(`/cards/${encodeURIComponent(slug)}/view`, { src: source })
    .catch(() => undefined);
}

export const nfcApi = {
  scan: async (payload: NfcScanPayload) => {
    const slug = extractSlug(payload.url ?? '') ?? 'UNQ000';
    await appendLocalHistory({ slug, uid: payload.uid, type: 'read' });
    await upsertLocalTag(payload.uid, slug !== 'UNQ000' ? slug : undefined);
    await apiClient.post('/nfc/scan', { ...payload, recordTap: false }).catch(() => undefined);
    if (slug !== 'UNQ000') {
      await apiClient.post('/nfc/tap', { ownerSlug: slug, source: 'nfc' }).catch(async () => {
        await logCardView(slug, 'nfc');
      });
    }
    return { ok: true };
  },
  write: async (payload: NfcWritePayload) => {
    const slug = extractSlug(payload.url) ?? 'UNQ000';
    await appendLocalHistory({ slug, uid: payload.uid, type: 'write' });
    await upsertLocalTag(payload.uid, slug !== 'UNQ000' ? slug : undefined);
    await apiClient
      .post('/nfc/write', payload)
      .catch(async () => {
        if (slug !== 'UNQ000') {
          await logCardView(slug, 'nfc');
        }
      });
    return { ok: true };
  },
  lock: async (payload: NfcLockPayload) => {
    await appendLocalHistory({ slug: 'UNQ000', uid: payload.uid, type: 'lock' });
    await upsertLocalTag(payload.uid, undefined);
    await apiClient.post('/nfc/lock', payload).catch(() => undefined);
    return { ok: true };
  },
  history: async () => {
    try {
      const server = await apiClient.get<{ items?: Array<any> }>('/nfc/history');
      const normalized = Array.isArray(server?.items)
        ? server.items.map((item: any, index: number) => ({
            id: String(item?.id ?? `h-${index}`),
            slug: extractSlug(item?.slug ?? item?.url ?? '') ?? String(item?.slug ?? 'UNQ000'),
            uid: item?.uid,
            type:
              item?.type === 'write' || item?.type === 'verify' || item?.type === 'lock' || item?.type === 'read'
                ? item.type
                : 'read',
            timestamp: String(item?.timestamp ?? item?.createdAt ?? new Date().toISOString()),
          }))
        : [];
      await writeLocalArray(NFC_HISTORY_KEY, normalized.slice(0, 100));
      return { items: normalized };
    } catch {
      // fallback below
    }

    const items = await readLocalArray<LocalNfcHistoryItem>(NFC_HISTORY_KEY);
    return {
      items,
    };
  },
  tags: async () => {
    try {
      const server = await apiClient.get<{ items?: Array<any> }>('/nfc/tags');
      const normalized = Array.isArray(server?.items)
        ? server.items.map((item: any) => ({
            uid: String(item?.uid ?? ''),
            name: String(item?.name ?? 'Метка'),
            linkedSlug: extractSlug(item?.linkedSlug ?? '') ?? item?.linkedSlug ?? undefined,
            status: String(item?.status ?? 'ok'),
            updatedAt: String(item?.updatedAt ?? item?.lastTapAt ?? new Date().toISOString()),
          }))
        : [];
      await writeLocalArray(NFC_TAGS_KEY, normalized.slice(0, 100));
      return { items: normalized };
    } catch {
      // fallback below
    }

    const items = await readLocalArray<LocalNfcTagItem>(NFC_TAGS_KEY);
    return {
      items,
    };
  },
  renameTag: async (uid: string, name: string) => {
    const cleanUid = String(uid).trim();
    const cleanName = String(name).trim();
    if (!cleanUid || !cleanName) {
      throw new ApiError('Tag uid and name are required', 400, 'VALIDATION_ERROR');
    }

    const current = await readLocalArray<LocalNfcTagItem>(NFC_TAGS_KEY);
    const next = current.map((item) => (item.uid === cleanUid ? { ...item, name: cleanName } : item));
    await writeLocalArray(NFC_TAGS_KEY, next);
    await apiClient.patch(`/nfc/tags/${encodeURIComponent(cleanUid)}`, { name: cleanName }).catch(() => undefined);
    return { ok: true };
  },
  clearLocalData: async () => {
    await storageDeleteItem(NFC_HISTORY_KEY);
    await storageDeleteItem(NFC_TAGS_KEY);
    return { ok: true };
  },
  markVerified: async (payload: { uid?: string; url?: string }) => {
    const slug = extractSlug(payload.url ?? '') ?? 'UNQ000';
    await appendLocalHistory({ slug, uid: payload.uid, type: 'verify' });
    if (payload.uid) {
      await upsertLocalTag(payload.uid, slug !== 'UNQ000' ? slug : undefined);
    }
    await apiClient.post('/nfc/verify', payload).catch(() => undefined);
    return { ok: true };
  },
};
