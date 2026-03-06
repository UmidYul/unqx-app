import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Wifi } from 'lucide-react-native';
import Svg, { Rect } from 'react-native-svg';
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

function formatClock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AppShell({ title, tokens, children }: AppShellProps): React.JSX.Element {
  const unreadNotifications = useNfcStore((state) => state.unreadNotifications);
  const setUnreadNotifications = useNfcStore((state) => state.setUnreadNotifications);
  const isNotificationsOpen = useNfcStore((state) => state.isNotificationsOpen);
  const setNotificationsOpen = useNfcStore((state) => state.setNotificationsOpen);
  const { items, unreadCount, isConnected, isLoading, markAllRead, refresh } = useNotifications();

  const [clock, setClock] = React.useState(formatClock());
  const handledNotificationsOpenRef = React.useRef(false);

  React.useEffect(() => {
    const timer = setInterval(() => setClock(formatClock()), 15000);
    return () => clearInterval(timer);
  }, []);

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
        <View style={styles.statusBar}>
          <Text style={[styles.statusTime, { color: tokens.textMuted }]}>{clock}</Text>
          <View style={styles.statusRight}>
            <View style={styles.signalRow}>
              {[3, 4, 5].map((h) => (
                <View key={h} style={[styles.signalBar, { height: h, backgroundColor: tokens.textMuted }]} />
              ))}
            </View>
            <Wifi size={14} strokeWidth={1.5} color={tokens.textMuted} />
            <View style={[styles.battery, { borderColor: tokens.textMuted }]}>
              <View style={[styles.batteryFill, { backgroundColor: tokens.textMuted }]} />
              <Svg width={3} height={6} viewBox='0 0 3 6'>
                <Rect x={0} y={1} width={3} height={4} rx={1} fill={tokens.textMuted} />
              </Svg>
            </View>
          </View>
        </View>

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
  statusBar: {
    paddingHorizontal: 26,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTime: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    marginRight: 1,
  },
  signalBar: {
    width: 3,
    borderRadius: 1.5,
  },
  battery: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
    gap: 1,
  },
  batteryFill: {
    width: 10,
    height: 5,
    borderRadius: 1,
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
