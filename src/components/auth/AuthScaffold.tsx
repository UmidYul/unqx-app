import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_DISPLAY_NAME, getBrandLogoSource } from '@/lib/brandAssets';
import { useThemeContext } from '@/theme/ThemeProvider';
import { ThemeTokens } from '@/types';
import { resolveShadowStyle } from '@/design/appDesign';
import { AppBackdrop } from '@/components/ui/AppBackdrop';

interface AuthScaffoldProps {
  tokens: ThemeTokens;
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  topAction?: {
    label: string;
    onPress: () => void;
  };
}

export function AuthScaffold({
  tokens,
  eyebrow = 'UNQX / Secure Access',
  title,
  subtitle,
  children,
  footer,
  topAction,
}: AuthScaffoldProps): React.JSX.Element {
  const { theme, design } = useThemeContext();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  return (
    <View style={[styles.root, { backgroundColor: tokens.phoneBg }]}>
      <AppBackdrop />

      {topAction ? (
        <Pressable
          onPress={topAction.onPress}
          style={[
            styles.topAction,
            {
              top: insets.top + 12,
              borderColor: design.chromeSurface.borderColor,
              backgroundColor: design.chromeSurface.backgroundColor,
            },
            resolveShadowStyle(design.chromeSurface),
          ]}
        >
          <Text style={[styles.topActionText, { color: tokens.text }]}>{topAction.label}</Text>
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 72,
            paddingBottom: Math.max(32, insets.bottom + 20),
          },
        ]}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.panel,
            {
              backgroundColor: design.authSurface.backgroundColor,
              borderColor: design.authSurface.borderColor,
            },
            resolveShadowStyle(design.authSurface),
          ]}
        >
          <LinearGradient colors={tokens.panelGradient} style={StyleSheet.absoluteFill} />

          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              <Image source={getBrandLogoSource(isDark)} style={styles.brandLogo} resizeMode='contain' />
            </View>
            <View style={styles.brandText}>
              <Text style={[styles.brandName, { color: tokens.text }]}>{APP_DISPLAY_NAME}</Text>
              <Text style={[styles.brandTagline, { color: tokens.textMuted }]}>Digital identity built from the homepage system</Text>
            </View>
          </View>

          <Text style={[styles.eyebrow, { color: tokens.textMuted }]}>{eyebrow}</Text>
          <Text style={[styles.title, { color: tokens.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: tokens.textSub }]}>{subtitle}</Text>

          <View style={styles.formSlot}>{children}</View>
        </View>

        {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  topAction: {
    position: 'absolute',
    left: 20,
    zIndex: 4,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActionText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  panel: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingVertical: 22,
    minHeight: 360,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 36,
    height: 36,
  },
  brandText: {
    flex: 1,
  },
  brandName: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
  brandTagline: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  eyebrow: {
    marginTop: 20,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
  },
  title: {
    marginTop: 12,
    fontSize: 34,
    lineHeight: 38,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  formSlot: {
    marginTop: 24,
  },
  footerSlot: {
    marginTop: 18,
    paddingHorizontal: 6,
  },
});
