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

export function getPreferredTelegramUrl(urlOrHandle: string): string | null {
  const candidate = String(urlOrHandle ?? '').trim();
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith('tg://')) {
    return candidate;
  }

  if (candidate.startsWith('@')) {
    const domain = candidate.slice(1).trim();
    return domain ? `tg://resolve?domain=${encodeURIComponent(domain)}` : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 't.me' && host !== 'telegram.me') {
    return null;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (!parts.length) {
    return null;
  }

  if ((parts[0] === 'joinchat' && parts[1]) || parts[0].startsWith('+')) {
    const inviteCode = parts[0] === 'joinchat' ? parts[1] : parts[0].slice(1);
    return inviteCode ? `tg://join?invite=${encodeURIComponent(inviteCode)}` : null;
  }

  const domain = parts[0].replace(/^@/, '');
  if (!domain) {
    return null;
  }

  const query = new URLSearchParams({ domain });
  if (parts[1] && /^\d+$/.test(parts[1])) {
    query.set('post', parts[1]);
  }
  const thread = parsed.searchParams.get('thread');
  if (thread) {
    query.set('thread', thread);
  }
  return `tg://resolve?${query.toString()}`;
}
