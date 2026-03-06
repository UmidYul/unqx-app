import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { BarChart3, House, UserRound, UsersRound, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MESSAGES } from '@/constants/messages';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { ThemeTokens, ScreenTab } from '@/types';
import { useNfcStore } from '@/store/nfcStore';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

interface BottomNavProps {
  tokens: ThemeTokens;
}

type NavItem = {
  id: ScreenTab;
  label: string;
  route: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: MESSAGES.ui.bottomNav.home, route: '/(tabs)/home', icon: House },
  { id: 'nfc', label: MESSAGES.ui.bottomNav.nfc, route: '/(tabs)/nfc', icon: Wifi },
  { id: 'people', label: MESSAGES.ui.bottomNav.people, route: '/(tabs)/people', icon: UsersRound },
  { id: 'analytics', label: MESSAGES.ui.bottomNav.analytics, route: '/(tabs)/analytics', icon: BarChart3 },
  { id: 'profile', label: MESSAGES.ui.bottomNav.profile, route: '/(tabs)/profile', icon: UserRound },
];

function resolveActiveTab(pathname: string): ScreenTab {
  if (pathname.includes('/nfc')) return 'nfc';
  if (pathname.includes('/people')) return 'people';
  if (pathname.includes('/analytics')) return 'analytics';
  if (pathname.includes('/profile')) return 'profile';
  return 'home';
}

export function BottomNav({ tokens }: BottomNavProps): React.JSX.Element {
  const { safeReplace } = useThrottledNavigation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const activeTab = useMemo(() => resolveActiveTab(pathname ?? ''), [pathname]);
  const setActiveTab = useNfcStore((state) => state.setActiveTab);
  const navBottomPadding =
    Platform.OS === 'ios'
      ? Math.max(6, insets.bottom)
      : Math.max(14, Math.min(24, (insets.bottom || 0) + 10));

  return (
    <View
      style={[
        styles.container,
        {
          borderTopColor: tokens.navBorder,
          backgroundColor: tokens.phoneBg,
          paddingBottom: navBottomPadding,
        },
      ]}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeTab;
        const Icon = item.icon;
        const color = isActive ? tokens.accent : tokens.text;

        return (
          <AnimatedPressable
            key={item.id}
            onPress={() => {
              if (pathname?.includes(`/${item.id}`)) {
                return;
              }
              setActiveTab(item.id);
              safeReplace(item.route);
            }}
            containerStyle={styles.itemWrap}
            style={[styles.item, { opacity: isActive ? 1 : 0.45 }]}
          >
            <View style={isActive ? styles.activeIcon : undefined}>
              <Icon size={20} color={color} strokeWidth={1.5} />
            </View>
            <Text style={[styles.label, { color }]}>{item.label}</Text>
            <View style={[styles.dot, { backgroundColor: isActive ? tokens.accent : 'transparent' }]} />
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
    minHeight: 79,
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 48,
    gap: 2,
    paddingBottom: 6,
  },
  itemWrap: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  label: {
    fontSize: 9.5,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  activeIcon: {
    transform: [{ scale: 1.04 }],
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 99,
  },
});
