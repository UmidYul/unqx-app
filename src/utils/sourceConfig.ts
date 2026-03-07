import { Link, Monitor, QrCode, Share2, Wifi } from 'lucide-react-native';

import { LanguageCode } from '@/constants/messages';
import { TapSource, ThemeTokens } from '@/types';

export interface SourceUiConfig {
  label: string;
  Icon: typeof Wifi;
  color: string;
}

export function getSourceConfig(tokens: ThemeTokens, language: LanguageCode = 'ru'): Record<TapSource, SourceUiConfig> {
  const isUz = language === 'uz';

  return {
    nfc: {
      label: isUz ? 'NFC bilaguzuk' : 'NFC браслет',
      Icon: Wifi,
      color: tokens.accent,
    },
    qr: {
      label: isUz ? 'QR kod' : 'QR код',
      Icon: QrCode,
      color: tokens.borderStrong,
    },
    share: {
      label: isUz ? "Ulashish" : 'Поделиться',
      Icon: Share2,
      color: tokens.text,
    },
    direct: {
      label: isUz ? "To'g'ridan-to'g'ri havola" : 'Прямая ссылка',
      Icon: Link,
      color: tokens.textMuted,
    },
    widget: {
      label: isUz ? 'Vidjet' : 'Виджет',
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
