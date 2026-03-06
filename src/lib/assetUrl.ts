const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://unqx.uz/api';

function resolveOrigin(): string {
  try {
    const url = new URL(API_BASE_URL);
    return url.origin;
  } catch {
    return 'https://unqx.uz';
  }
}

const ORIGIN = resolveOrigin();

export function resolveAssetUrl(value?: string | null): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return undefined;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  if (raw.startsWith('/')) {
    return `${ORIGIN}${raw}`;
  }

  return `${ORIGIN}/${raw}`;
}
