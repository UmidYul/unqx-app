import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isRunningInExpoGo } from 'expo';

import { MESSAGES } from '@/constants/messages';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLanguageContext } from '@/i18n/LanguageProvider';
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

function pickNotificationTime(raw: Partial<NotificationItem> & Record<string, unknown>): string {
  const candidate = raw.time ?? raw.timestamp ?? raw.createdAt ?? raw.updatedAt;
  return String(candidate ?? '').trim();
}

function formatNotificationTime(value: string, isUz: boolean): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return isUz ? 'hozirgina' : 'только что';
  }

  const lower = raw.toLowerCase();
  if (
    lower.includes('ago') ||
    lower.includes('назад') ||
    lower.includes('oldin') ||
    lower.includes('сегодня') ||
    lower.includes('bugun') ||
    lower.includes('вчера') ||
    lower.includes('kecha')
  ) {
    return raw;
  }

  const parsed = Number.isFinite(Number(raw)) && /^\d+$/.test(raw)
    ? new Date(Number(raw))
    : new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const diffMs = Math.max(0, Date.now() - parsed.getTime());
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return isUz ? 'hozirgina' : 'только что';
  if (diffMin < 60) return isUz ? `${diffMin} daqiqa oldin` : `${diffMin} мин назад`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return isUz ? `${diffHours} soat oldin` : `${diffHours} ч назад`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return isUz ? `${diffDays} kun oldin` : `${diffDays} д назад`;

  return parsed.toLocaleString(isUz ? 'uz-UZ' : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
    time: pickNotificationTime(raw),
    read: raw.read ?? false,
    type,
  };
}

export function useNotifications(): UseNotificationsResult {
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const { language } = useLanguageContext();
  const isUz = language === 'uz';

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

  const sourceItems = query.data ?? [];
  const items = useMemo(
    () => sourceItems.map((item) => ({ ...item, time: formatNotificationTime(item.time, isUz) })),
    [isUz, sourceItems],
  );
  const unreadCount = useMemo(() => sourceItems.filter((item) => !item.read).length, [sourceItems]);

  useEffect(() => {
    const isExpoGo = isRunningInExpoGo();
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
