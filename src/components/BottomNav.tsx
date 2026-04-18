import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { BarChart3, House, UserRound, UsersRound, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MESSAGES } from '@/constants/messages';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { ThemeTokens, ScreenTab } from '@/types';
import { useNfcStore } from '@/store/nfcStore';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

interface BottomNavProps {
  tokens: ThemeTokens;
  themeOverride?: {
    bg: string;
    text: string;
    accent: string;
    border: string;
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
  const { safeReplace } = useThrottledNavigation();
  const pathname = usePathname();
  const { signedIn } = useAuthStatus();
  const insets = useSafeAreaInsets();
  const activeTab = useMemo(() => resolveActiveTab(pathname ?? ''), [pathname]);
  const setActiveTab = useNfcStore((state) => state.setActiveTab);
  const navBottomPadding =
    Platform.OS === 'ios'
      ? Math.max(10, insets.bottom - 2)
      : Math.max(14, Math.min(24, (insets.bottom || 0) + 10));
  const navTopPadding = Platform.OS === 'ios' ? 10 : 6;
  const navMinHeight = Platform.OS === 'ios' ? 92 : 79;

  // Формируем подписи динамически из актуального MESSAGES
  const navItems = useMemo(() => {
    const labels = MESSAGES.ui.bottomNav;
    return NAV_CONFIG.map((item) => ({
      ...item,
      label: labels[item.id as keyof typeof labels] || item.id,
    }));
  }, [MESSAGES.ui.bottomNav]);

  return (
    <View
      style={[
        styles.container,
        {
          borderTopColor: themeOverride?.border ?? tokens.navBorder,
          backgroundColor: themeOverride?.bg ?? tokens.phoneBg,
          minHeight: navMinHeight,
          paddingTop: navTopPadding,
          paddingBottom: navBottomPadding,
        },
      ]}
    >
      {navItems.map((item) => {
        const isActive = item.id === activeTab;
        const Icon = item.icon;
        const color = isActive ? (themeOverride?.accent ?? tokens.accent) : (themeOverride?.text ?? tokens.text);

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
            style={[styles.item, { opacity: isActive ? 1 : 0.45 }]}
          >
            <View style={isActive ? styles.activeIcon : undefined}>
              <Icon size={20} color={color} strokeWidth={1.5} />
            </View>
            <Text numberOfLines={1} style={[styles.label, { color }]}>{item.label}</Text>
            <View style={[styles.dot, { backgroundColor: isActive ? (themeOverride?.accent ?? tokens.accent) : 'transparent' }]} />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    gap: 4,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  itemWrap: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  activeIcon: {
    transform: [{ scale: 1.04 }],
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 99,
    marginTop: 1,
  },
});
