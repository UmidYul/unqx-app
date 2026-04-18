import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeTokens } from '@/types';
import { BottomNav } from '@/components/BottomNav';
import { useNfcStore } from '@/store/nfcStore';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPanel } from '@/components/NotificationPanel';

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
  } | null;
}

export function AppShell({ title, tokens, children, allowNotifications = true, themeOverride }: AppShellProps): React.JSX.Element {
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

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: themeOverride?.bg ?? tokens.bg }]}>
      <View style={[styles.phoneFrame, { backgroundColor: themeOverride?.bg ?? tokens.phoneBg }]}>
        <View style={styles.topBar}>
          <Text style={[styles.title, { color: themeOverride?.text ?? tokens.text }]}>{title}</Text>
          {allowNotifications ? (
            <Pressable onPress={() => setNotificationsOpen(true)} style={styles.notificationButton}>
              <Bell size={22} color={themeOverride?.text ?? tokens.text} strokeWidth={1.5} />
              {unreadNotifications > 0 ? (
                <View style={[styles.dot, { backgroundColor: themeOverride?.accent ?? tokens.accent, borderColor: themeOverride?.bg ?? tokens.phoneBg }]} />
              ) : null}
            </Pressable>
          ) : <View style={styles.notificationPlaceholder} />}
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 6,
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 23,
    fontFamily: 'Inter_600SemiBold',
  },
  notificationButton: {
    marginTop: 4,
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationPlaceholder: {
    width: 28,
    height: 28,
  },
  dot: {
    position: 'absolute',
    top: 1,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 99,
    borderWidth: 2,
  },
  content: {
    flex: 1,
    marginTop: 4,
  },
});
