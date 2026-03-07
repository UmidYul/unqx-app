import {
  CreditCard,
  Globe,
  Instagram,
  Mail,
  MessageCircle,
  Music2,
  Phone,
  Send,
  Youtube,
} from 'lucide-react-native';

export const BUTTON_ICONS = [
  { key: 'phone', label: 'Phone', Icon: Phone },
  { key: 'telegram', label: 'Telegram', Icon: Send },
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'tiktok', label: 'TikTok', Icon: Music2 },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
  { key: 'website', label: 'Website', Icon: Globe },
  { key: 'email', label: 'Email', Icon: Mail },
  { key: 'card', label: 'Card', Icon: CreditCard },
  { key: 'other', label: 'Other', Icon: Globe },
] as const;

export type ButtonIconKey = (typeof BUTTON_ICONS)[number]['key'];

const ICON_ALIASES: Record<string, ButtonIconKey> = {
  send: 'telegram',
  tg: 'telegram',
  globe: 'website',
  link: 'website',
  web: 'website',
  mail: 'email',
  ig: 'instagram',
  insta: 'instagram',
  yt: 'youtube',
  wa: 'whatsapp',
  creditcard: 'card',
  credit_card: 'card',
  payment: 'card',
  pay: 'card',
  click: 'card',
  chat: 'other',
  briefcase: 'other',
};

const ICON_KEYS = new Set<ButtonIconKey>(BUTTON_ICONS.map((item) => item.key));

export function normalizeButtonIconKey(value: string): ButtonIconKey {
  const raw = String(value || '').trim().toLowerCase();
  if (ICON_KEYS.has(raw as ButtonIconKey)) {
    return raw as ButtonIconKey;
  }
  if (raw in ICON_ALIASES) {
    return ICON_ALIASES[raw];
  }
  return 'other';
}

export function inferButtonIcon(input: { label?: string; url?: string; currentIcon?: string }): ButtonIconKey {
  const label = String(input.label || '').toLowerCase();
  const url = String(input.url || '').toLowerCase().trim();
  const signature = `${label} ${url}`;

  if (/^tel:|\b(phone|call|звон|позвон)\b/.test(signature)) {
    return 'phone';
  }
  if (/wa\.me|whatsapp|what's app|ватсап/.test(signature)) {
    return 'whatsapp';
  }
  if (/t\.me|telegram|телеграм/.test(signature)) {
    return 'telegram';
  }
  if (/instagram|insta|inst\.com/.test(signature)) {
    return 'instagram';
  }
  if (/tiktok/.test(signature)) {
    return 'tiktok';
  }
  if (/youtu\.be|youtube/.test(signature)) {
    return 'youtube';
  }
  if (/^mailto:|\bemail\b|@/.test(signature)) {
    return 'email';
  }
  if (/^card:|\b(click|pay|payment|card|merchant|карта)\b/.test(signature)) {
    return 'card';
  }
  if (/^https?:\/\//.test(url) || /\b(www\.|site|website|web|link|сайт)\b/.test(signature)) {
    return 'website';
  }

  return normalizeButtonIconKey(input.currentIcon || 'other');
}

export function findButtonIcon(key: string) {
  const normalized = normalizeButtonIconKey(key);
  return BUTTON_ICONS.find((item) => item.key === normalized) ?? BUTTON_ICONS[0];
}
