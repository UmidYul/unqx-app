import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/BottomNav';
import { useThemeContext } from '@/theme/ThemeProvider';

interface PublicShellTheme {
  bg: string;
  text: string;
  accent: string;
  border: string;
  surface?: string;
  mutedText?: string;
  primaryBg?: string;
  primaryText?: string;
  chipBg?: string;
  chipText?: string;
  backdropStart?: string;
  backdropEnd?: string;
  backdropAccent?: string;
  backdropGlow?: string;
  overlayStroke?: string;
  overlayStrokeSoft?: string;
  isDark?: boolean;
}

interface PublicScreenShellProps {
  children: React.ReactNode;
  themeOverride?: PublicShellTheme | null;
}

const PUBLIC_NAV_THEME: PublicShellTheme = {
  bg: '#ffffff',
  text: '#111111',
  accent: '#111111',
  border: '#e5e5df',
  surface: '#ffffff',
  mutedText: '#6b6b66',
  primaryBg: '#111111',
  primaryText: '#ffffff',
  chipBg: '#ffffff',
  chipText: '#111111',
  backdropStart: '#ffffff',
  backdropEnd: '#fdfdfb',
  backdropAccent: 'rgba(17,17,17,0.016)',
  backdropGlow: 'rgba(17,17,17,0.01)',
  overlayStroke: 'rgba(17,17,17,0.02)',
  overlayStrokeSoft: 'rgba(17,17,17,0.012)',
  isDark: false,
} as const;

export function PublicScreenShell({ children, themeOverride }: PublicScreenShellProps): React.JSX.Element {
  const { tokens } = useThemeContext();
  const theme = themeOverride ?? PUBLIC_NAV_THEME;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.bg }]}>
      <View style={[styles.background, { backgroundColor: theme.bg }]}>
        <View style={[styles.grid, { borderColor: theme.overlayStroke ?? 'rgba(17,17,17,0.04)' }]} />
        <View style={[styles.glowTop, { backgroundColor: theme.backdropAccent ?? 'rgba(17,17,17,0.05)' }]} />
        <View style={[styles.glowBottom, { backgroundColor: theme.backdropGlow ?? 'rgba(17,17,17,0.04)' }]} />
      </View>
      <View style={styles.content}>{children}</View>
      <BottomNav tokens={tokens} themeOverride={theme} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
    backgroundColor: 'transparent',
    borderColor: 'rgba(17,17,17,0.04)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(17,17,17,0.05)',
  },
  glowBottom: {
    position: 'absolute',
    right: -110,
    bottom: 60,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: 'rgba(17,17,17,0.04)',
  },
  content: {
    flex: 1,
  },
});
