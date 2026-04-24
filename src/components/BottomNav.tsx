import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { BarChart3, House, UserRound, UsersRound, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MESSAGES } from '@/constants/messages';
import { resolveShadowStyle } from '@/design/appDesign';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { ThemeTokens, ScreenTab } from '@/types';
import { useNfcStore } from '@/store/nfcStore';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useThemeContext } from '@/theme/ThemeProvider';

interface BottomNavProps {
  tokens: ThemeTokens;
  themeOverride?: {
    bg: string;
    text: string;
    accent: string;
    border: string;
    surface?: string;
    mutedText?: string;
    primaryBg?: string;
    primaryText?: string;
  } | null;
}


const NAV_CONFIG = [
  { id: 'home', route: '/(tabs)/home', icon: House },
  { id: 'nfc', route: '/(tabs)/nfc', icon: Wifi },
  { id: 'people', route: '/(tabs)/people', icon: UsersRound },
  { id: 'analytics', route: '/(tabs)/analytics', icon: BarChart3 },
  { id: 'profile', route: '/(tabs)/profile', icon: UserRound },
];

function resolveActiveTab(pathname: string): ScreenTab {
  if (pathname.includes('/nfc')) return 'nfc';
  if (pathname.includes('/people')) return 'people';
  if (pathname.includes('/analytics')) return 'analytics';
  if (pathname.includes('/profile')) return 'profile';
  return 'home';
}

export function BottomNav({ tokens, themeOverride }: BottomNavProps): React.JSX.Element {
  const { design } = useThemeContext();
  const { safeReplace } = useThrottledNavigation();
  const pathname = usePathname();
  const { signedIn } = useAuthStatus();
  const insets = useSafeAreaInsets();
  const activeTab = useMemo(() => resolveActiveTab(pathname ?? ''), [pathname]);
  const setActiveTab = useNfcStore((state) => state.setActiveTab);
  const navBottomPadding =
    Platform.OS === 'ios'
      ? Math.max(10, insets.bottom)
      : Math.max(12, Math.min(22, (insets.bottom || 0) + 8));
  const navTopPadding = Platform.OS === 'ios' ? 10 : 8;
  const navMinHeight = Platform.OS === 'ios' ? 104 : 90;

  // Формируем подписи динамически из актуального MESSAGES
  const navItems = useMemo(() => {
    const labels = MESSAGES.ui.bottomNav;
    return NAV_CONFIG.map((item) => ({
      ...item,
      label: labels[item.id as keyof typeof labels] || item.id,
    }));
  }, [MESSAGES.ui.bottomNav]);
  const navSurfaceBackground = themeOverride?.surface ?? tokens.surface;
  const navSurfaceBorder = themeOverride?.border ?? tokens.border;
  const activeBackground = themeOverride?.primaryBg ?? tokens.accent;
  const activeText = themeOverride?.primaryText ?? tokens.accentText;
  const inactiveText = themeOverride?.mutedText ?? tokens.textSub;
  const activeAccent = themeOverride?.accent ?? tokens.accent;

  return (
    <View
      style={[
        styles.container,
        {
          borderTopColor: 'transparent',
          backgroundColor: navSurfaceBackground,
          minHeight: navMinHeight,
          paddingTop: navTopPadding,
          paddingBottom: navBottomPadding,
        },
      ]}
    >
      <View
        style={[
          styles.surface,
          {
            borderColor: navSurfaceBorder,
            backgroundColor: navSurfaceBackground,
          },
        ]}
      >
        {navItems.map((item) => {
          const isActive = item.id === activeTab;
          const Icon = item.icon;
          const color = isActive ? activeAccent : inactiveText;

          return (
            <AnimatedPressable
              key={item.id}
              onPress={() => {
                if (pathname?.includes(`/${item.id}`)) {
                  return;
                }
                if (!signedIn && item.id !== 'nfc') {
                  safeReplace('/login');
                  return;
                }
                setActiveTab(item.id as ScreenTab);
                safeReplace(item.route);
              }}
              containerStyle={styles.itemWrap}
              style={[
                styles.item,
                {
                  backgroundColor: 'transparent',
                  borderColor: 'transparent',
                },
              ]}
            >
              <View style={styles.iconWrap}>
                <Icon size={20} color={color} strokeWidth={1.65} />
              </View>
              <Text numberOfLines={1} style={[styles.label, { color }]}>{item.label}</Text>
              <View style={[styles.dot, { backgroundColor: isActive ? activeAccent : 'transparent' }]} />
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
  },
  surface: {
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    gap: 3,
    paddingHorizontal: 2,
    paddingTop: 10,
    borderRadius: 0,
    borderWidth: 0,
  },
  itemWrap: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  iconWrap: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    marginTop: 3,
  },
});
