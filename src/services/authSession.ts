import { ApiError, apiClient, getAuthToken, setAuthToken } from '@/lib/apiClient';
import { captureSentryException, setSentryUser } from '@/lib/sentry';
import { MESSAGES } from '@/constants/messages';
import { storageDeleteItem, storageGetItem, storageSetItem } from '@/lib/secureStorage';
import { clearPersistedQueryCache } from '@/lib/queryClient';
import { secureStorage } from '@/utils/secureStorage';
import { toUserErrorMessage } from '@/utils/errorMessages';

const AUTH_SIGNED_KEY = 'unqx.auth.signed';

const TOKEN_KEYS = ['token', 'accessToken', 'bearer', 'jwt', 'authToken', 'idToken'] as const;
const REFRESH_TOKEN_KEYS = ['refreshToken', 'refresh_token', 'refresh'] as const;
const TOKEN_ENVELOPE_KEYS = ['data', 'auth', 'session', 'result', 'payload'] as const;

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

export interface AvailabilityFieldResult {
  provided: boolean;
  valid: boolean;
  available: boolean;
  checked: boolean;
  message: string;
}

export interface RegistrationAvailabilityResult {
  supported: boolean;
  login: AvailabilityFieldResult;
  email: AvailabilityFieldResult;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function findFirstStringInKnownEnvelopes(value: unknown, keys: readonly string[]): string | null {
  if (!isObject(value)) {
    return null;
  }

  const direct = findFirstStringByKeys(value, keys);
  if (direct) {
    return direct;
  }

  for (const envelopeKey of TOKEN_ENVELOPE_KEYS) {
    const envelope = value[envelopeKey];
    if (!envelope) {
      continue;
    }

    if (Array.isArray(envelope)) {
      for (const item of envelope) {
        if (!isObject(item)) {
          continue;
        }
        const nested = findFirstStringByKeys(item, keys);
        if (nested) {
          return nested;
        }
      }
      continue;
    }

    if (isObject(envelope)) {
      const nested = findFirstStringByKeys(envelope, keys);
      if (nested) {
        return nested;
      }

      // Some backends return one more level of wrappers inside known auth envelopes.
      for (const nestedValue of Object.values(envelope)) {
        if (!isObject(nestedValue)) {
          continue;
        }
        const deepNested = findFirstStringByKeys(nestedValue, keys);
        if (deepNested) {
          return deepNested;
        }
      }
    }
  }

  return null;
}

function findToken(value: unknown): string | null {
  return findFirstStringInKnownEnvelopes(value, TOKEN_KEYS);
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
  const signed = await storageGetItem(AUTH_SIGNED_KEY);
  if (!token && signed !== '1') {
    return false;
  }

  // Always validate cached auth state against server session before declaring authenticated.
  try {
    await apiClient.getFirst(['/me', '/auth/me']);
    await setSignedFlag(true);
    return true;
  } catch (error) {
    const isInvalidSession = error instanceof ApiError && (error.status === 401 || error.status === 403);
    if (isInvalidSession) {
      await secureStorage.clear().catch(() => undefined);
      await setSignedFlag(false);
    }
    return false;
  }
}

async function persistAuth(payload: unknown): Promise<string | null> {
  const token = findToken(payload);
  if (token) {
    await setAuthToken(token);
  }

  const refreshToken = findFirstStringInKnownEnvelopes(payload, REFRESH_TOKEN_KEYS);
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
  if (error instanceof ApiError && error.code && AUTH_CODE_MESSAGES[error.code]) {
    return AUTH_CODE_MESSAGES[error.code];
  }
  return toUserErrorMessage(error, MESSAGES.auth.errorTitle);
}

function toAuthError(error: unknown): AuthSessionError {
  if (error instanceof ApiError) {
    return new AuthSessionError(authErrorMessage(error), error.code, error.status);
  }

  return new AuthSessionError(authErrorMessage(error), null, 0);
}

function buildAvailabilityField(provided: boolean): AvailabilityFieldResult {
  return {
    provided,
    valid: true,
    available: true,
    checked: false,
    message: '',
  };
}

function normalizeAvailabilityField(raw: unknown, provided: boolean): AvailabilityFieldResult {
  const field = buildAvailabilityField(provided);
  if (!raw || typeof raw !== 'object') {
    return field;
  }

  const value = raw as Record<string, unknown>;
  if (typeof value.provided === 'boolean') field.provided = value.provided;
  if (typeof value.valid === 'boolean') field.valid = value.valid;
  if (typeof value.available === 'boolean') field.available = value.available;
  if (typeof value.checked === 'boolean') field.checked = value.checked;
  if (typeof value.message === 'string') field.message = value.message;
  return field;
}

function extractEmailFromPayload(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const email = (value as Record<string, unknown>).email;
  if (typeof email !== 'string') {
    return undefined;
  }

  const normalized = email.trim().toLowerCase();
  return normalized || undefined;
}

async function hasAuthenticatedSession(): Promise<boolean> {
  try {
    const payload = await apiClient.get<any>('/auth/me');
    return Boolean(payload?.authenticated);
  } catch {
    return false;
  }
}

export async function checkRegistrationAvailability(input: {
  login?: string;
  email?: string;
}): Promise<RegistrationAvailabilityResult> {
  const login = String(input.login ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const hasLogin = Boolean(login);
  const hasEmail = Boolean(email);

  const defaults: RegistrationAvailabilityResult = {
    supported: true,
    login: buildAvailabilityField(hasLogin),
    email: buildAvailabilityField(hasEmail),
  };

  if (!hasLogin && !hasEmail) {
    return defaults;
  }

  try {
    const payload = await apiClient.get<any>('/auth/check-availability', {
      query: {
        login: hasLogin ? login : undefined,
        email: hasEmail ? email : undefined,
      },
    });

    return {
      supported: true,
      login: normalizeAvailabilityField(payload?.login, hasLogin),
      email: normalizeAvailabilityField(payload?.email, hasEmail),
    };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return {
        ...defaults,
        supported: false,
      };
    }
    throw toAuthError(error);
  }
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

export async function loginWithApi(
  login: string,
  password: string,
): Promise<{ requiresVerification: boolean; message?: string; email?: string }> {
  try {
    const payload = await apiClient.post<any>('/auth/login', {
      login,
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
        email: extractEmailFromPayload(payload),
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
        email: extractEmailFromPayload(error.details),
      };
    }
    throw toAuthError(error);
  }
}

export async function registerWithApi(input: {
  firstName: string;
  city: string;
  login: string;
  email?: string | null;
  password: string;
  confirmPassword: string;
}): Promise<{ signedIn: boolean; message?: string; email?: string }> {
  try {
    const payload = await apiClient.post<any>('/auth/register', input);
    const hasEmail = Boolean(String(input.email ?? '').trim());
    const redirectTo = String(payload?.redirectTo ?? '').trim().toLowerCase();
    const token = await persistAuth(payload);
    if (token || payload?.user || payload?.authenticated === true) {
      await setSignedFlag(true);
      if (!applySentryUserFromPayload(payload)) {
        await syncSentryUserFromApi();
      }
      return { signedIn: true };
    }

    // Some deployments return register success without auto-login cookie.
    if (payload?.ok === true) {
      const sessionReady = await hasAuthenticatedSession();
      if (sessionReady) {
        await setSignedFlag(true);
        await syncSentryUserFromApi();
        return { signedIn: true };
      }

      const loginResult = await loginWithApi(input.login, input.password).catch(() => null);
      if (loginResult && !loginResult.requiresVerification) {
        return { signedIn: true };
      }
      if (loginResult?.requiresVerification) {
        await setSignedFlag(false);
        return {
          signedIn: false,
          message: loginResult.message ?? MESSAGES.auth.unverifiedEmail,
          email: loginResult.email ?? (input.email ?? undefined),
        };
      }

      // Some deployments create the account first, then allow login slightly later.
      if (!hasEmail) {
        await new Promise((resolve) => {
          setTimeout(resolve, 250);
        });
        const retryLoginResult = await loginWithApi(input.login, input.password).catch(() => null);
        if (retryLoginResult && !retryLoginResult.requiresVerification) {
          return { signedIn: true };
        }
      }
    }

    if (hasEmail && redirectTo.includes('verify-email')) {
      await setSignedFlag(false);
      return {
        signedIn: false,
        message: payload?.message || MESSAGES.auth.registerDoneVerify,
        email: input.email ?? undefined,
      };
    }

    await setSignedFlag(false);
    return {
      signedIn: false,
      message: payload?.message || (hasEmail ? MESSAGES.auth.registerDoneVerify : MESSAGES.auth.registerDoneLogin),
      email: input.email ?? undefined,
    };
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function sendEmailOtpWithApi(email: string): Promise<{ ok: boolean; message: string }> {
  try {
    const payload = await apiClient.post<any>('/auth/send-otp', {
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
    const payload = await apiClient.post<any>('/auth/verify-email', {
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
    const payload = await apiClient.post<any>('/auth/forgot-password', {
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
    const payload = await apiClient.post<any>('/auth/reset-password', input);
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
    await apiClient.post('/auth/logout', {});
  } catch {
    // noop
  }

  await secureStorage.clear();
  await clearPersistedQueryCache();
  await setSignedFlag(false);
  setSentryUser(null);
}
