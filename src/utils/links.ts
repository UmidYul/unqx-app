import { TapSource } from '@/types';

const PROFILE_BASE_URL = 'https://unqx.uz';

function normalizeSlug(value: string): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

export function getProfileURL(slug: string, source: TapSource = 'direct'): string {
  const safeSlug = normalizeSlug(slug);
  const base = `${PROFILE_BASE_URL}/${safeSlug}`;
  if (source === 'direct') {
    return base;
  }
  return `${base}?src=${encodeURIComponent(source)}`;
}

export function extractSlug(urlOrSlug: string): string | null {
  const candidate = String(urlOrSlug || '').trim();
  if (!candidate) {
    return null;
  }

  const direct = normalizeSlug(candidate);
  if (/^[A-Z]{3}\d{3}$/.test(direct)) {
    return direct;
  }

  try {
    const url = new URL(candidate);
    const tail = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
    const normalized = normalizeSlug(tail);
    return /^[A-Z]{3}\d{3}$/.test(normalized) ? normalized : null;
  } catch {
    const match = candidate.match(/([A-Za-z]{3}\d{3})/);
    if (!match) {
      return null;
    }
    const normalized = normalizeSlug(match[1]);
    return /^[A-Z]{3}\d{3}$/.test(normalized) ? normalized : null;
  }
}
