import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useRetryImageUri } from '@/hooks/useRetryImageUri';

export interface SocialPalette {
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  mutedText: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  success: string;
  danger: string;
}

export function formatSocialDate(value: string | undefined, locale: string): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function SocialVerifiedIcon({ color, size = 14 }: { color: string; size?: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24'>
      <Path
        fill={color}
        d='M12 2.5l2.2 1.8 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L21.5 12l-1.8 2.2.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 21.5l-2.2-1.8-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2.5 12l1.8-2.2-.3-2.8 2.5-1.2 1.2-2.5 2.8.3L12 2.5Zm-1.1 13.1 5-5-1.1-1.1-3.9 3.9-1.8-1.8-1.1 1.1 2.9 2.9Z'
      />
    </Svg>
  );
}

export function SocialAvatar({
  name,
  avatarUrl,
  initials,
  size = 42,
  palette,
}: {
  name: string;
  avatarUrl?: string;
  initials?: string;
  size?: number;
  palette: SocialPalette;
}): React.JSX.Element {
  const avatarImage = useRetryImageUri(avatarUrl);
  const fallbackText = String(initials ?? name ?? 'U').trim().slice(0, 2).toUpperCase() || 'U';

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.surfaceAlt,
          borderColor: palette.border,
        },
      ]}
    >
      {avatarImage.showImage && avatarImage.imageUri ? (
        <Image
          key={`${avatarUrl}:${avatarImage.retryCount}`}
          source={{ uri: avatarImage.imageUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={avatarImage.onError}
        />
      ) : (
        <Text style={[styles.avatarText, { color: palette.text, fontSize: Math.max(12, size * 0.34) }]}>{fallbackText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
});
