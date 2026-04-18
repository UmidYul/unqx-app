import { NFCHistoryItem, NFCTag, NfcTemplateId, NfcWritablePayload } from '@/types';
import { extractSlug, getProfileURL } from '@/utils/links';

const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

function trimValue(value: string): string {
  return String(value ?? '').trim();
}

function ensureHttps(value: string): string {
  return URL_SCHEME_RE.test(value) ? value : `https://${value}`;
}

function collapseWhitespace(value: string): string {
  return trimValue(value).replace(/\s+/g, ' ');
}

function normalizePlainText(value: string): string | null {
  const next = collapseWhitespace(value);
  return next ? next : null;
}

function normalizeSiteUrl(value: string): string | null {
  const next = trimValue(value);
  if (!next) {
    return null;
  }

  try {
    const parsed = new URL(ensureHttps(next));
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeTelegram(value: string): string | null {
  const next = trimValue(value);
  if (!next) {
    return null;
  }

  const cleaned = next
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^telegram\.me\//i, '')
    .replace(/^@/, '')
    .trim();

  return cleaned ? `https://t.me/${cleaned}` : null;
}

function normalizeInstagram(value: string): string | null {
  const next = trimValue(value);
  if (!next) {
    return null;
  }

  const cleaned = next
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .trim();

  return cleaned ? `https://instagram.com/${cleaned}` : null;
}

function normalizeTikTok(value: string): string | null {
  const next = trimValue(value);
  if (!next) {
    return null;
  }

  const cleaned = next
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^tiktok\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .trim();

  return cleaned ? `https://www.tiktok.com/@${cleaned}` : null;
}

function normalizeWhatsApp(value: string): string | null {
  const digits = trimValue(value).replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

function normalizePhone(value: string): string | null {
  const cleaned = trimValue(value).replace(/(?!^\+)[^\d]/g, '');
  return cleaned ? `tel:${cleaned}` : null;
}

function normalizeEmail(value: string): string | null {
  const cleaned = trimValue(value);
  return cleaned ? `mailto:${cleaned}` : null;
}

function truncateText(value: string, maxLength = 72): string {
  const next = collapseWhitespace(value);
  if (next.length <= maxLength) {
    return next;
  }
  return `${next.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildSlugPayload(slug: string): NfcWritablePayload {
  const url = getProfileURL(slug, 'nfc');
  return {
    kind: 'url',
    value: url,
    displayValue: `unqx.uz/${slug}`,
    slug,
    templateId: 'slug',
  };
}

export function buildTemplatePayload(templateId: NfcTemplateId, rawValue: string): NfcWritablePayload | null {
  if (templateId === 'slug') {
    return null;
  }

  if (templateId === 'plain_text') {
    const textValue = normalizePlainText(rawValue);
    if (!textValue) {
      return null;
    }
    return {
      kind: 'text',
      value: textValue,
      displayValue: textValue,
      templateId,
    };
  }

  const urlValue =
    templateId === 'telegram'
      ? normalizeTelegram(rawValue)
      : templateId === 'instagram'
        ? normalizeInstagram(rawValue)
        : templateId === 'site'
          ? normalizeSiteUrl(rawValue)
          : templateId === 'tiktok'
            ? normalizeTikTok(rawValue)
            : templateId === 'whatsapp'
              ? normalizeWhatsApp(rawValue)
              : templateId === 'phone'
                ? normalizePhone(rawValue)
                : templateId === 'email'
                  ? normalizeEmail(rawValue)
                  : null;

  if (!urlValue) {
    return null;
  }

  const slug = extractSlug(urlValue) ?? undefined;
  return {
    kind: 'url',
    value: urlValue,
    displayValue: urlValue,
    slug,
    templateId,
  };
}

export function getPayloadPreview(payloadKind?: NFCTag['payloadKind'], payloadValue?: string, slug?: string): string {
  if (payloadKind === 'url') {
    if (slug) {
      return `unqx.uz/${slug}`;
    }
    return trimValue(payloadValue ?? '');
  }

  if (payloadKind === 'text') {
    return truncateText(payloadValue ?? '');
  }

  return '';
}

export function getHistoryPreview(item: Pick<NFCHistoryItem, 'payloadKind' | 'payloadValue' | 'slug' | 'displayValue'>): string {
  if (item.displayValue) {
    return item.payloadKind === 'text' ? truncateText(item.displayValue) : item.displayValue;
  }
  return getPayloadPreview(item.payloadKind, item.payloadValue, item.slug);
}
