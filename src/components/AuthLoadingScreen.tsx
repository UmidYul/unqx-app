import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { resolveShadowStyle } from '@/design/appDesign';
import { SkeletonBlock } from '@/components/ui/skeleton';
import { APP_DISPLAY_NAME, getBrandLogoSource } from '@/lib/brandAssets';
import { useThemeContext } from '@/theme/ThemeProvider';
import { ThemeTokens } from '@/types';

interface AuthLoadingScreenProps {
  tokens: ThemeTokens;
  title?: string;
}

export function AuthLoadingScreen({ tokens, title = 'Проверка сессии...' }: AuthLoadingScreenProps): React.JSX.Element {
  const { theme, design } = useThemeContext();
  const isDark = theme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: tokens.phoneBg }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: design.authSurface.backgroundColor,
            borderColor: design.authSurface.borderColor,
          },
          resolveShadowStyle(design.authSurface),
        ]}
      >
        <Image source={getBrandLogoSource(isDark)} style={styles.logo} resizeMode='contain' />
        <Text style={[styles.brand, { color: tokens.text }]}>{APP_DISPLAY_NAME}</Text>
        <Text style={[styles.caption, { color: tokens.textMuted }]}>{title}</Text>
        <SkeletonBlock tokens={tokens} width={96} height={10} radius={999} />
        <SkeletonBlock tokens={tokens} width={Math.min(240, Math.max(160, title.length * 6))} height={10} radius={999} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 28,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  brand: {
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
  caption: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
