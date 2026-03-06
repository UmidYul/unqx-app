import React from 'react';
import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { dismissPushPromptPermanently, getPushPromptState, markPushPermissionRequested } from '@/lib/pushPrompt';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';

function resolveProjectId(): string | undefined {
  const fromEasConfig = (Constants as any)?.easConfig?.projectId;
  const fromExpoConfig = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
  return fromEasConfig ?? fromExpoConfig;
}

async function registerForPushNotifications(Notifications: typeof import('expo-notifications')): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: resolveProjectId(),
  });
  return token.data;
}

export async function requestPushPermission(): Promise<string | null> {
  const isExpoGo =
    (Constants as any)?.executionEnvironment === 'storeClient' || (Constants as any)?.appOwnership === 'expo';
  if (isExpoGo) {
    return null;
  }

  await markPushPermissionRequested();
  const Notifications = await import('expo-notifications');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'UNQX',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  return registerForPushNotifications(Notifications);
}

interface PushPayload {
  type?: 'tap' | 'order' | 'report' | 'elite' | string;
}

export function usePushNotifications(): {
  token: string | null;
  promptVisible: boolean;
  requestPermissionFromPrompt: () => Promise<void>;
  dismissPrompt: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const { safePush } = useThrottledNavigation();
  const isExpoGo =
    (Constants as any)?.executionEnvironment === 'storeClient' || (Constants as any)?.appOwnership === 'expo';
  const [token, setToken] = React.useState<string | null>(null);
  const [promptVisible, setPromptVisible] = React.useState(false);

  const evaluatePromptVisibility = React.useCallback(async () => {
    const state = await getPushPromptState();
    setPromptVisible(state.shouldPrompt && !state.permissionRequested);
  }, []);

  const requestPermissionFromPrompt = React.useCallback(async () => {
    if (isExpoGo) {
      setPromptVisible(false);
      return;
    }

    setPromptVisible(false);
    await markPushPermissionRequested();
    const Notifications = await import('expo-notifications');
    const nextToken = await registerForPushNotifications(Notifications);
    if (nextToken) {
      setToken(nextToken);
    }
  }, [isExpoGo]);

  const dismissPrompt = React.useCallback(async () => {
    setPromptVisible(false);
    await dismissPushPromptPermanently();
  }, []);

  React.useEffect(() => {
    if (isExpoGo) {
      setPromptVisible(false);
      return;
    }
    void evaluatePromptVisibility();
  }, [evaluatePromptVisibility, isExpoGo]);

  React.useEffect(() => {
    if (isExpoGo) {
      return;
    }
    if (Platform.OS === 'android') {
      void import('expo-notifications')
        .then((Notifications) =>
          Notifications.setNotificationChannelAsync('default', {
            name: 'UNQX',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
          }),
        )
        .catch(() => undefined);
    }
  }, [isExpoGo]);

  React.useEffect(() => {
    let receivedSubscription: { remove: () => void } | null = null;
    let responseSubscription: { remove: () => void } | null = null;
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        if (!isExpoGo) {
          void import('expo-notifications')
            .then((Notifications) => Notifications.setBadgeCountAsync(0))
            .catch(() => undefined);
          void evaluatePromptVisibility();
        }
      }
    });

    if (!isExpoGo) {
      void import('expo-notifications')
        .then((Notifications) => {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });

          receivedSubscription = Notifications.addNotificationReceivedListener(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          });

          responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = (response.notification.request.content.data ?? {}) as PushPayload;
            if (data.type === 'tap' || data.type === 'report') {
              safePush('/(tabs)/analytics');
              return;
            }
            if (data.type === 'order') {
              safePush('/(tabs)/profile?wristband=1');
              return;
            }
            if (data.type === 'elite') {
              safePush('/(tabs)/people?tab=leaderboard');
            }
          });
        })
        .catch(() => undefined);
    }

    return () => {
      receivedSubscription?.remove();
      responseSubscription?.remove();
      appStateSubscription.remove();
    };
  }, [evaluatePromptVisibility, isExpoGo, queryClient, safePush]);

  return {
    token,
    promptVisible,
    requestPermissionFromPrompt,
    dismissPrompt,
  };
}
