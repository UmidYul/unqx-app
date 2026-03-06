import { Link, Monitor, QrCode, Share2, Wifi } from 'lucide-react-native';

import { TapSource, ThemeTokens } from '@/types';

export interface SourceUiConfig {
  label: string;
  Icon: typeof Wifi;
  color: string;
}

export function getSourceConfig(tokens: ThemeTokens): Record<TapSource, SourceUiConfig> {
  return {
    nfc: {
      label: 'NFC браслет',
      Icon: Wifi,
      color: tokens.accent,
    },
    qr: {
      label: 'QR код',
      Icon: QrCode,
      color: tokens.borderStrong,
    },
    share: {
      label: 'Поделиться',
      Icon: Share2,
      color: tokens.text,
    },
    direct: {
      label: 'Прямая ссылка',
      Icon: Link,
      color: tokens.textMuted,
    },
    widget: {
      label: 'Виджет',
      Icon: Monitor,
      color: tokens.textSub,
    },
  };
}

export function resolveSource(source: string): TapSource {
  const normalized = String(source || '')
    .trim()
    .toLowerCase();
  if (normalized === 'telegram') return 'share';
  if (normalized === 'other') return 'direct';
  if (normalized === 'nfc_scan' || normalized === 'nfc_write') return 'nfc';
  if (normalized === 'nfc' || normalized === 'qr' || normalized === 'direct' || normalized === 'share' || normalized === 'widget') {
    return normalized;
  }

  if (normalized.includes('nfc')) return 'nfc';
  if (normalized.includes('qr')) return 'qr';
  if (normalized.includes('telegram') || normalized.includes('share') || normalized.includes('ref')) return 'share';
  if (normalized.includes('widget')) return 'widget';
  if (normalized.includes('direct') || normalized.includes('link') || normalized.includes('web') || normalized.includes('site')) {
    return 'direct';
  }

  return 'direct';
}
