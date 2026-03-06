import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { SkeletonBlock } from '@/components/ui/skeleton';
import { ThemeTokens } from '@/types';

interface AuthLoadingScreenProps {
  tokens: ThemeTokens;
  title?: string;
}

export function AuthLoadingScreen({ tokens, title = 'Проверка сессии...' }: AuthLoadingScreenProps): React.JSX.Element {
  return (
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      <Image source={require('../../assets/brand/logo.png')} style={styles.logo} resizeMode='contain' />
      <Text style={[styles.brand, { color: tokens.text }]}>UNQX</Text>
      <SkeletonBlock tokens={tokens} width={76} height={10} radius={6} />
      <SkeletonBlock tokens={tokens} width={Math.min(240, Math.max(160, title.length * 6))} height={10} radius={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
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
