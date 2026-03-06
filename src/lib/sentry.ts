import * as Sentry from '@sentry/react-native';

let initialized = false;

function envEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function hasDsn(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());
}

function isSentryEnabled(): boolean {
  if (!hasDsn()) {
    return false;
  }

  // Keep Sentry off in local dev unless explicitly enabled.
  if (__DEV__ && !envEnabled(process.env.EXPO_PUBLIC_SENTRY_ENABLE_DEV)) {
    return false;
  }

  if (process.env.EXPO_PUBLIC_SENTRY_ENABLED !== undefined) {
    return envEnabled(process.env.EXPO_PUBLIC_SENTRY_ENABLED);
  }

  return true;
}

export function initSentry(): void {
  if (initialized || !isSentryEnabled()) {
    return;
  }

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.2,
    debug: envEnabled(process.env.EXPO_PUBLIC_SENTRY_DEBUG),
  });

  initialized = true;
}

export function sentryWrap<T>(Component: T): T {
  if (!isSentryEnabled()) {
    return Component;
  }
  return Sentry.wrap(Component as any) as T;
}

export function captureSentryException(
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1],
): void {
  if (!isSentryEnabled()) {
    return;
  }
  Sentry.captureException(error, context);
}

export function addSentryBreadcrumb(
  breadcrumb: Parameters<typeof Sentry.addBreadcrumb>[0],
): void {
  if (!isSentryEnabled()) {
    return;
  }
  Sentry.addBreadcrumb(breadcrumb);
}

export function setSentryUser(
  user: {
    id?: string | number;
    username?: string;
  } | null,
): void {
  if (!isSentryEnabled()) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id !== undefined ? String(user.id) : undefined,
    username: user.username,
  });
}
