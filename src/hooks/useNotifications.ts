import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';

import { MESSAGES } from '@/constants/messages';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queryKeys } from '@/lib/queryKeys';
import { fetchNotificationsLike, markNotificationsReadLike } from '@/services/mobileApi';
import { NotificationItem } from '@/types';
import { toast } from '@/utils/toast';

interface NotificationsResponse {
  items?: NotificationItem[];
}

interface UseNotificationsResult {
  items: NotificationItem[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

function normalizeNotification(raw: Partial<NotificationItem> & { id?: string }): NotificationItem {
  const type: NotificationItem['type'] =
    raw.type === 'tap' || raw.type === 'write' || raw.type === 'report' || raw.type === 'elite'
      ? raw.type
      : 'system';

  return {
    id: raw.id ?? `notif-${Date.now()}`,
    title: raw.title ?? 'UNQX update',
    subtitle: raw.subtitle ?? '',
    time: raw.time ?? 'now',
    read: raw.read ?? false,
    type,
  };
}

export function useNotifications(): UseNotificationsResult {
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });

  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const response = (await fetchNotificationsLike()) as NotificationsResponse;
      const items = Array.isArray(response?.items) ? response.items.map((item) => normalizeNotification(item)) : [];
      return items;
    },
    refetchInterval: 30_000,
  });

  const markAllReadMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: markNotificationsReadLike,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<NotificationItem[]>(queryKeys.notifications);
      queryClient.setQueryData<NotificationItem[]>(queryKeys.notifications, (current = []) =>
        current.map((item) => ({ ...item, read: true })),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
  const markAllReadAsync = markAllReadMutation.mutateAsync;

  const items = query.data ?? [];
  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  useEffect(() => {
    const isExpoGo =
      (Constants as any)?.executionEnvironment === 'storeClient' || (Constants as any)?.appOwnership === 'expo';
    if (isExpoGo) {
      return;
    }

    void import('expo-notifications')
      .then((Notifications) => Notifications.setBadgeCountAsync(unreadCount))
      .catch(() => undefined);
  }, [unreadCount]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient]);

  const markAllRead = useCallback(async () => {
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    await markAllReadAsync();
  }, [isOnline, markAllReadAsync]);

  return {
    items,
    unreadCount,
    isConnected: isOnline,
    isLoading: query.isLoading,
    refresh,
    markAllRead,
  };
}
