import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Award, BarChart2, Bell, PenLine, Wifi, X } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { EmptyState } from '@/components/EmptyState';
import { MESSAGES } from '@/constants/messages';
import { NotificationItem, ThemeTokens } from '@/types';

interface NotificationPanelProps {
  visible: boolean;
  tokens: ThemeTokens;
  items: NotificationItem[];
  isConnected: boolean;
  isLoading: boolean;
  onClose: () => void;
  onMarkAllRead: () => void | Promise<void>;
}

function formatTypeLabel(type: NotificationItem['type']): string {
  if (type === 'tap') return 'Новый тап';
  if (type === 'write') return MESSAGES.toast.nfcWritten;
  if (type === 'report') return 'Недельный отчёт';
  if (type === 'elite') return 'UNQ Elite';
  return 'Система';
}

function TypeIcon({ type, color }: { type: NotificationItem['type']; color: string }): React.JSX.Element {
  if (type === 'tap') return <Wifi size={16} strokeWidth={1.5} color={color} />;
  if (type === 'write') return <PenLine size={16} strokeWidth={1.5} color={color} />;
  if (type === 'report') return <BarChart2 size={16} strokeWidth={1.5} color={color} />;
  if (type === 'elite') return <Award size={16} strokeWidth={1.5} color={color} />;
  return <Wifi size={16} strokeWidth={1.5} color={color} />;
}

export function NotificationPanel({
  visible,
  tokens,
  items,
  isConnected,
  isLoading,
  onClose,
  onMarkAllRead,
}: NotificationPanelProps): React.JSX.Element {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 260 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, visible]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  const list = items;

  return (
    <Modal visible={visible} transparent animationType='none' onRequestClose={onClose}>
      <Animated.View style={[styles.root, { backgroundColor: tokens.phoneBg }, panelStyle]}>
        <View style={[styles.header, { borderBottomColor: tokens.border }]}> 
          <View>
            <Text style={[styles.title, { color: tokens.text }]}>Уведомления</Text>
            <Text style={[styles.mode, { color: tokens.textMuted }]}>{isConnected ? 'Realtime' : 'Polling mode'}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={22} strokeWidth={1.5} color={tokens.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {!isLoading && list.length === 0 ? (
            <EmptyState
              icon={Bell}
              title='Нет уведомлений'
              subtitle='Тапы и события появятся здесь'
              tokens={tokens}
            />
          ) : null}
          {list.map((item) => (
            <View
              key={item.id}
              style={[
                styles.item,
                {
                  borderBottomColor: tokens.border,
                  opacity: 1,
                },
              ]}
            >
              {!item.read ? <View style={[styles.unreadDot, { backgroundColor: tokens.accent }]} /> : null}
              <View style={[styles.itemIcon, { backgroundColor: tokens.surface }]}>
                <TypeIcon type={item.type} color={tokens.accent} />
              </View>
              <View style={styles.itemBody}>
                <Text style={[styles.itemTitle, { color: tokens.text }]}>{item.title || formatTypeLabel(item.type)}</Text>
                <Text style={[styles.itemSubtitle, { color: tokens.textMuted }]}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.itemTime, { color: tokens.textMuted }]}>{item.time}</Text>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  mode: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 20,
    paddingTop: 6,
  },
  item: {
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 20,
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody: {
    flex: 1,
    paddingRight: 6,
  },
  itemTitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  itemSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  itemTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
