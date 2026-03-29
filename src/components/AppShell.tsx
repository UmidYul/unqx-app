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
}

export function AppShell({ title, tokens, children }: AppShellProps): React.JSX.Element {
  const unreadNotifications = useNfcStore((state) => state.unreadNotifications);
  const setUnreadNotifications = useNfcStore((state) => state.setUnreadNotifications);
  const isNotificationsOpen = useNfcStore((state) => state.isNotificationsOpen);
  const setNotificationsOpen = useNfcStore((state) => state.setNotificationsOpen);
  const { items, unreadCount, isConnected, isLoading, markAllRead, refresh } = useNotifications();

  const handledNotificationsOpenRef = React.useRef(false);

  React.useEffect(() => {
    setUnreadNotifications(unreadCount);
  }, [setUnreadNotifications, unreadCount]);

  React.useEffect(() => {
    if (!isNotificationsOpen) {
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
  }, [isNotificationsOpen, markAllRead, refresh, unreadCount]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: tokens.bg }]}>
      <View style={[styles.phoneFrame, { backgroundColor: tokens.phoneBg }]}>
        <View style={styles.topBar}>
          <Text style={[styles.title, { color: tokens.text }]}>{title}</Text>
          <Pressable onPress={() => setNotificationsOpen(true)} style={styles.notificationButton}>
            <Bell size={22} color={tokens.text} strokeWidth={1.5} />
            {unreadNotifications > 0 ? (
              <View style={[styles.dot, { backgroundColor: tokens.accent, borderColor: tokens.phoneBg }]} />
            ) : null}
          </Pressable>
        </View>

        <View style={styles.content}>{children}</View>

        <BottomNav tokens={tokens} />
      </View>

      <NotificationPanel
        visible={isNotificationsOpen}
        tokens={tokens}
        items={items}
        isConnected={isConnected}
        isLoading={isLoading}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={markAllRead}
      />
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
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
