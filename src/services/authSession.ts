import { ApiError, apiClient, getAuthToken, setAuthToken } from '@/lib/apiClient';
import { captureSentryException, setSentryUser } from '@/lib/sentry';
import { MESSAGES } from '@/constants/messages';
import { storageDeleteItem, storageGetItem, storageSetItem } from '@/lib/secureStorage';
import { clearPersistedQueryCache } from '@/lib/queryClient';
import { secureStorage } from '@/utils/secureStorage';

const AUTH_SIGNED_KEY = 'unqx.auth.signed';

const TOKEN_KEYS = ['token', 'accessToken', 'bearer', 'jwt', 'authToken', 'idToken'] as const;
const REFRESH_TOKEN_KEYS = ['refreshToken', 'refresh_token', 'refresh'] as const;

const AUTH_CODE_MESSAGES: Record<string, string> = MESSAGES.auth.codeMessages;

export class AuthSessionError extends Error {
  code: string | null;
  status: number;

  constructor(message: string, code: string | null, status: number) {
    super(message);
    this.name = 'AuthSessionError';
    this.code = code;
    this.status = status;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function findToken(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const candidate = value.trim();
    if (candidate.length > 20 && !candidate.includes(' ')) {
      return candidate;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findToken(item);
      if (nested) return nested;
    }
    return null;
  }

  if (!isObject(value)) {
    return null;
  }

  for (const key of TOKEN_KEYS) {
    const direct = value[key];
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findToken(nestedValue);
    if (nested) {
      return nested;
    }
  }

  return null;
}

async function setSignedFlag(value: boolean): Promise<void> {
  if (value) {
    await storageSetItem(AUTH_SIGNED_KEY, '1');
    return;
  }
  await storageDeleteItem(AUTH_SIGNED_KEY);
}

export async function isSignedIn(): Promise<boolean> {
  const token = await getAuthToken();
  if (token) {
    return true;
  }

  const signed = await storageGetItem(AUTH_SIGNED_KEY);
  if (signed !== '1') {
    return false;
  }

  // Validate persisted signed flag against real server session (cookie-based auth).
  try {
    await apiClient.getFirst(['/me', '/auth/me']);
    return true;
  } catch {
    await setSignedFlag(false);
    return false;
  }
}

async function persistAuth(payload: unknown): Promise<string | null> {
  const token = findToken(payload);
  if (token) {
    await setAuthToken(token);
  }

  const refreshToken = findFirstStringByKeys(payload, REFRESH_TOKEN_KEYS);
  if (refreshToken) {
    await secureStorage.setRefreshToken(refreshToken);
  }
  return token;
}

function findFirstStringByKeys(value: unknown, keys: readonly string[]): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }
  return null;
}

function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && AUTH_CODE_MESSAGES[error.code]) {
      return AUTH_CODE_MESSAGES[error.code];
    }
    return error.message || MESSAGES.auth.errorTitle;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return MESSAGES.auth.errorTitle;
}

function toAuthError(error: unknown): AuthSessionError {
  if (error instanceof ApiError) {
    return new AuthSessionError(authErrorMessage(error), error.code, error.status);
  }

  return new AuthSessionError(authErrorMessage(error), null, 0);
}

function applySentryUserFromPayload(payload: unknown): boolean {
  const source = payload as Record<string, any> | null;
  const user = source?.user ?? source?.profile ?? source?.me ?? null;
  const id = user?.id ?? source?.id;
  const username = user?.slug ?? user?.username ?? source?.slug ?? source?.username;
  if (!id && !username) {
    return false;
  }
  setSentryUser({
    id,
    username: username ? String(username) : undefined,
  });
  return true;
}

async function syncSentryUserFromApi(): Promise<void> {
  try {
    const payload = await apiClient.get<any>('/me');
    if (!applySentryUserFromPayload(payload)) {
      setSentryUser(null);
    }
  } catch (error) {
    captureSentryException(error, {
      tags: { area: 'auth', op: 'sync_sentry_user_from_api' },
    });
  }
}

export async function loginWithApi(email: string, password: string): Promise<{ requiresVerification: boolean; message?: string }> {
  try {
    const payload = await apiClient.postFirst<any>(['/auth/login', '/login'], {
      email,
      password,
      rememberMe: true,
    });

    const token = await persistAuth(payload);
    const authenticated = Boolean(payload?.authenticated || payload?.ok || payload?.user);

    if (authenticated || token) {
      await setSignedFlag(true);
      if (!applySentryUserFromPayload(payload)) {
        await syncSentryUserFromApi();
      }
    }

    if (!token && payload?.code === 'UNVERIFIED') {
      return {
        requiresVerification: true,
        message: payload?.error || MESSAGES.auth.unverifiedEmail,
      };
    }

    return {
      requiresVerification: false,
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNVERIFIED') {
      return {
        requiresVerification: true,
        message: error.message || MESSAGES.auth.unverifiedEmail,
      };
    }
    throw toAuthError(error);
  }
}

export async function registerWithApi(input: {
  firstName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<{ signedIn: boolean; message?: string; email?: string }> {
  try {
    const payload = await apiClient.postFirst<any>(['/auth/register', '/register'], input);
    const token = await persistAuth(payload);
    const authenticated = Boolean(payload?.authenticated || payload?.ok === true && payload?.user);

    if (token || payload?.user || payload?.authenticated === true || authenticated) {
      await setSignedFlag(true);
      if (!applySentryUserFromPayload(payload)) {
        await syncSentryUserFromApi();
      }
      return { signedIn: true };
    }

    await setSignedFlag(false);
    return {
      signedIn: false,
      message: payload?.message || MESSAGES.auth.registerDoneVerify,
      email: input.email,
    };
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function sendEmailOtpWithApi(email: string): Promise<{ ok: boolean; message: string }> {
  try {
    const payload = await apiClient.postFirst<any>(['/auth/send-otp', '/send-otp'], {
      email,
    });

    return {
      ok: Boolean(payload?.ok ?? true),
      message: MESSAGES.auth.otpSent,
    };
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function verifyEmailWithApi(email: string, code: string): Promise<{ signedIn: boolean; message?: string }> {
  try {
    const payload = await apiClient.postFirst<any>(['/auth/verify-email', '/verify-email'], {
      email,
      code,
    });

    const token = await persistAuth(payload);
    const authenticated = Boolean(payload?.authenticated || payload?.ok || payload?.user);
    if (authenticated || token) {
      await setSignedFlag(true);
      if (!applySentryUserFromPayload(payload)) {
        await syncSentryUserFromApi();
      }
      return {
        signedIn: true,
      };
    }

    return {
      signedIn: false,
      message: payload?.message || MESSAGES.auth.emailVerifiedLogin,
    };
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function forgotPasswordWithApi(email: string): Promise<{ message: string }> {
  try {
    const payload = await apiClient.postFirst<any>(['/auth/forgot-password', '/forgot-password'], {
      email,
    });

    return {
      message: payload?.message || MESSAGES.auth.forgotPasswordSent,
    };
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function resetPasswordWithApi(input: {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const payload = await apiClient.postFirst<any>(['/auth/reset-password', '/reset-password'], input);
    await secureStorage.clear();
    await setSignedFlag(false);

    return {
      ok: Boolean(payload?.ok ?? true),
      message: MESSAGES.auth.passwordResetDone,
    };
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function signOut(): Promise<void> {
  try {
    await apiClient.postFirst(['/auth/logout', '/logout'], {});
  } catch {
    // noop
  }

  await secureStorage.clear();
  await clearPersistedQueryCache();
  await setSignedFlag(false);
  setSentryUser(null);
}
