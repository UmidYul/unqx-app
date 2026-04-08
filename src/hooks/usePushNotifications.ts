import React from 'react';
import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { dismissPushPromptPermanently, getPushPromptState, markPushPermissionRequested } from '@/lib/pushPrompt';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';

function resolveProjectId(): string | undefined {
  const fromEasConfig = (Constants as any)?.easConfig?.projectId;
  const fromExpoConfig = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
  return fromEasConfig ?? fromExpoConfig;
}

async function getExpoPushTokenSafe(Notifications: typeof import('expo-notifications')): Promise<string | null> {
  const projectId = resolveProjectId();

  if (projectId) {
    try {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      return token?.data ?? null;
    } catch {
      // Fall through to no-arg call for builds where projectId metadata is missing.
    }
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token?.data ?? null;
  } catch {
    return null;
  }
}

async function registerForPushNotifications(Notifications: typeof import('expo-notifications')): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Ask only once when permission state is undecided. Re-requesting after explicit deny
  // creates a bad UX where users can see the prompt repeatedly on app opens.
  if (existingStatus === 'undetermined') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  return getExpoPushTokenSafe(Notifications);
}

async function getNativePushToken(Notifications: typeof import('expo-notifications')): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  try {
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const raw = nativeToken?.data;
    if (typeof raw === 'string') {
      return raw;
    }
    if (raw === null || raw === undefined) {
      return null;
    }
    return JSON.stringify(raw);
  } catch {
    return null;
  }
}

async function getExistingPushToken(Notifications: typeof import('expo-notifications')): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  return getExpoPushTokenSafe(Notifications);
}

export async function requestPushPermission(): Promise<string | null> {
  if (isRunningInExpoGo()) {
    return null;
  }

  const Notifications = await import('expo-notifications');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'UNQX',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const token = await registerForPushNotifications(Notifications);
  await markPushPermissionRequested();
  return token;
}

interface PushPayload {
  type?: 'tap' | 'order' | 'report' | 'elite' | string;
}

export function usePushNotifications(): {
  token: string | null;
  nativeToken: string | null;
  promptVisible: boolean;
  requestPermissionFromPrompt: () => Promise<void>;
  dismissPrompt: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const { safePush } = useThrottledNavigation();
  const isExpoGo = isRunningInExpoGo();
  const [token, setToken] = React.useState<string | null>(null);
  const [nativeToken, setNativeToken] = React.useState<string | null>(null);
  const [promptVisible, setPromptVisible] = React.useState(false);

  const refreshTokens = React.useCallback(async (): Promise<void> => {
    if (isExpoGo) {
      return;
    }

    const Notifications = await import('expo-notifications');
    const [expoToken, nativeDeviceToken] = await Promise.all([
      getExistingPushToken(Notifications),
      getNativePushToken(Notifications),
    ]);

    setToken((prev) => (prev === expoToken ? prev : expoToken));
    setNativeToken((prev) => (prev === nativeDeviceToken ? prev : nativeDeviceToken));
  }, [isExpoGo]);

  const evaluatePromptVisibility = React.useCallback(async () => {
    if (isExpoGo) {
      setPromptVisible(false);
      return;
    }

    const Notifications = await import('expo-notifications');
    const permissions = await Notifications.getPermissionsAsync().catch(() => null);
    const status = permissions?.status;
    if (status && status !== 'undetermined') {
      setPromptVisible(false);
      await markPushPermissionRequested();
      return;
    }

    const state = await getPushPromptState();
    setPromptVisible(state.shouldPrompt && !state.permissionRequested);
  }, [isExpoGo]);

  const requestPermissionFromPrompt = React.useCallback(async () => {
    if (isExpoGo) {
      setPromptVisible(false);
      return;
    }

    setPromptVisible(false);
    const Notifications = await import('expo-notifications');
    const nextToken = await registerForPushNotifications(Notifications);
    const nextNativeToken = await getNativePushToken(Notifications);
    await markPushPermissionRequested();
    if (nextToken) {
      setToken(nextToken);
    }
    if (nextNativeToken) {
      setNativeToken(nextNativeToken);
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
    if (isExpoGo) {
      return;
    }
    void refreshTokens().catch(() => undefined);
  }, [isExpoGo, refreshTokens]);

  React.useEffect(() => {
    let receivedSubscription: { remove: () => void } | null = null;
    let responseSubscription: { remove: () => void } | null = null;
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        if (!isExpoGo) {
          void import('expo-notifications')
            .then((Notifications) => Notifications.setBadgeCountAsync(0))
            .catch(() => undefined);
          void refreshTokens().catch(() => undefined);
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
  }, [evaluatePromptVisibility, isExpoGo, queryClient, refreshTokens, safePush]);

  return {
    token,
    nativeToken,
    promptVisible,
    requestPermissionFromPrompt,
    dismissPrompt,
  };
}
