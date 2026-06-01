import { API_ORIGIN } from '@/config/api';
import { extractSlug } from '@/utils/links';

const EXTERNAL_SCHEME_REGEX = /^(tel|mailto|tg|sms):/i;

export function toAbsoluteSiteUrl(value: string): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw, API_ORIGIN).toString();
  } catch {
    return null;
  }
}

export function isSameSiteUrl(value: string): boolean {
  const absolute = toAbsoluteSiteUrl(value);
  if (!absolute) {
    return false;
  }

  try {
    return new URL(absolute).origin === API_ORIGIN;
  } catch {
    return false;
  }
}

export function isSiteHomeUrl(value: string): boolean {
  const absolute = toAbsoluteSiteUrl(value);
  if (!absolute) {
    return false;
  }

  try {
    const url = new URL(absolute);
    if (url.origin !== API_ORIGIN) {
      return false;
    }

    return url.pathname === '/' || url.pathname === '';
  } catch {
    return false;
  }
}

export function getSiteProfileSlug(value: string): string | null {
  const absolute = toAbsoluteSiteUrl(value);
  if (!absolute) {
    return null;
  }

  try {
    const url = new URL(absolute);
    if (url.origin !== API_ORIGIN) {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) {
      return null;
    }

    return extractSlug(segments[0]);
  } catch {
    return null;
  }
}

export function isExternalSchemeUrl(value: string): boolean {
  return EXTERNAL_SCHEME_REGEX.test(String(value ?? '').trim());
}
