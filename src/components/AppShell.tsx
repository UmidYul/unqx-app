import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackdrop } from '@/components/ui/AppBackdrop';
import { ThemeTokens } from '@/types';
import { BottomNav } from '@/components/BottomNav';
import { useNfcStore } from '@/store/nfcStore';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPanel } from '@/components/NotificationPanel';
import { resolveShadowStyle } from '@/design/appDesign';
import { useThemeContext } from '@/theme/ThemeProvider';
import { APP_DISPLAY_NAME, getBrandLogoSource } from '@/lib/brandAssets';

interface AppShellProps {
  title: string;
  tokens: ThemeTokens;
  children: React.ReactNode;
  allowNotifications?: boolean;
  themeOverride?: {
    bg: string;
    text: string;
    accent: string;
    border: string;
    surface?: string;
    mutedText?: string;
    chipBg?: string;
    chipText?: string;
    primaryBg?: string;
    primaryText?: string;
    backdropStart?: string;
    backdropEnd?: string;
    backdropAccent?: string;
    backdropGlow?: string;
    overlayStroke?: string;
    overlayStrokeSoft?: string;
    isDark?: boolean;
  } | null;
}

export function AppShell({ title, tokens, children, allowNotifications = true, themeOverride }: AppShellProps): React.JSX.Element {
  const { theme, design } = useThemeContext();
  const unreadNotifications = useNfcStore((state) => state.unreadNotifications);
  const setUnreadNotifications = useNfcStore((state) => state.setUnreadNotifications);
  const isNotificationsOpen = useNfcStore((state) => state.isNotificationsOpen);
  const setNotificationsOpen = useNfcStore((state) => state.setNotificationsOpen);
  const { items, unreadCount, isConnected, isLoading, markAllRead, refresh } = useNotifications({ enabled: allowNotifications });

  const handledNotificationsOpenRef = React.useRef(false);

  React.useEffect(() => {
    setUnreadNotifications(unreadCount);
  }, [setUnreadNotifications, unreadCount]);

  React.useEffect(() => {
    if (!allowNotifications || !isNotificationsOpen) {
      handledNotificationsOpenRef.current = false;
      return;
    }

    if (handledNotificationsOpenRef.current) {
      return;
    }
    handledNotificationsOpenRef.current = true;

    void refresh();
    if (unreadCount > 0) {
      void markAllRead();
    }
  }, [allowNotifications, isNotificationsOpen, markAllRead, refresh, unreadCount]);

  const isDark = themeOverride?.isDark ?? (theme === 'dark');
  const headerText = themeOverride?.text ?? tokens.text;
  const headerAccent = themeOverride?.mutedText ?? tokens.textMuted;
  const shellBorder = themeOverride?.border ?? design.chromeSurface.borderColor;
  const shellSurface = themeOverride?.surface ?? design.chromeSurface.backgroundColor;
  const chipSurface = themeOverride?.chipBg ?? design.chipSurface.backgroundColor;
  const chipBorder = themeOverride?.border ?? design.chipSurface.borderColor;
  const safeBackground = themeOverride?.bg ?? tokens.phoneBg;
  const brandMarkSurface = themeOverride?.surface ?? tokens.surface;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: safeBackground }]}>
      <AppBackdrop themeOverride={themeOverride} />

      <View style={[styles.phoneFrame, { backgroundColor: 'transparent' }]}>
        <View style={styles.topBar}>
          <View
            style={[
              styles.topBarShell,
              {
                borderColor: shellBorder,
                backgroundColor: shellSurface,
              },
              resolveShadowStyle(design.chromeSurface),
            ]}
          >
            <View style={styles.brandCluster}>
              <View style={[styles.brandMark, { backgroundColor: brandMarkSurface, borderColor: shellBorder }]}>
                <Image source={getBrandLogoSource(isDark)} style={styles.brandLogo} resizeMode='contain' />
              </View>
              <View style={styles.titleWrap}>
                <Text style={[styles.kicker, { color: headerAccent }]}>{APP_DISPLAY_NAME}</Text>
                <Text style={[styles.title, { color: headerText }]}>{title}</Text>
              </View>
            </View>
            {allowNotifications ? (
              <Pressable
                onPress={() => setNotificationsOpen(true)}
                style={[
                  styles.notificationButton,
                  {
                    borderColor: chipBorder,
                    backgroundColor: chipSurface,
                  },
                  resolveShadowStyle(design.chipSurface),
                ]}
              >
                <Bell size={20} color={themeOverride?.text ?? tokens.text} strokeWidth={1.5} />
                {unreadNotifications > 0 ? (
                  <View style={[styles.dot, { backgroundColor: themeOverride?.accent ?? tokens.accent, borderColor: safeBackground }]} />
                ) : null}
              </Pressable>
            ) : <View style={styles.notificationPlaceholder} />}
          </View>
        </View>

        <View style={styles.content}>{children}</View>

        <BottomNav tokens={tokens} themeOverride={themeOverride} />
      </View>

      {allowNotifications ? (
        <NotificationPanel
          visible={isNotificationsOpen}
          tokens={tokens}
          items={items}
          isConnected={isConnected}
          isLoading={isLoading}
          onClose={() => setNotificationsOpen(false)}
          onMarkAllRead={markAllRead}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  phoneFrame: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  topBarShell: {
    minHeight: 74,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 28,
    height: 28,
  },
  titleWrap: {
    flex: 1,
    paddingRight: 8,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 0.2,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    marginTop: 3,
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
  },
  notificationButton: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationPlaceholder: {
    width: 42,
    height: 42,
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 99,
    borderWidth: 2,
  },
  content: {
    flex: 1,
    marginTop: 2,
  },
});
