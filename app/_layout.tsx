import React from 'react';
import { Stack } from 'expo-router';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Toast from 'react-native-toast-message';

import { BiometricLockScreen } from '@/components/BiometricLockScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotificationPermissionPrompt } from '@/components/NotificationPermissionPrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { BiometricType, useBiometrics } from '@/hooks/useBiometrics';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { apiClient } from '@/lib/apiClient';
import { queryClient, queryPersister, queryPersistMaxAge } from '@/lib/queryClient';
import { storageGetItem, storageSetItem } from '@/lib/secureStorage';
import { captureSentryException, initSentry, sentryWrap, setSentryUser } from '@/lib/sentry';
import { signOut } from '@/services/authSession';
import { ThemeProvider, useThemeContext } from '@/theme/ThemeProvider';
import { useNfcStore } from '@/store/nfcStore';
import { toastConfig } from '@/utils/toastConfig';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';

initSentry();
const APP_LOCK_AFTER_BACKGROUND_MS = 2000;

function RootNavigator(): React.JSX.Element {
  const { theme, tokens, autoTheme } = useThemeContext();
  const { signedIn } = useAuthStatus();
  const { safeReplace } = useThrottledNavigation();
  const { getBiometricsEnabled, getBiometricType } = useBiometrics();
  const { isOnline } = useNetworkStatus();
  const { token, promptVisible, requestPermissionFromPrompt, dismissPrompt } = usePushNotifications();
  const storeTheme = useNfcStore((state) => state.theme);
  const storeAutoTheme = useNfcStore((state) => state.autoTheme);
  const setTheme = useNfcStore((state) => state.setTheme);
  const setAutoTheme = useNfcStore((state) => state.setAutoTheme);
  const lastTokenRef = React.useRef<string | null>(null);
  const appStateRef = React.useRef(AppState.currentState);
  const backgroundAtRef = React.useRef<number | null>(null);
  const [lockVisible, setLockVisible] = React.useState(false);
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<BiometricType>(null);

  React.useEffect(() => {
    if (storeTheme !== theme) {
      setTheme(theme);
    }
    if (storeAutoTheme !== autoTheme) {
      setAutoTheme(autoTheme);
    }
  }, [autoTheme, setAutoTheme, setTheme, storeAutoTheme, storeTheme, theme]);

  React.useEffect(() => {
    const syncToken = async () => {
      if (!token) {
        return;
      }
      if (lastTokenRef.current === token) {
        return;
      }

      const persisted = await storageGetItem('unqx.push.last-token');
      if (persisted === token) {
        lastTokenRef.current = token;
        return;
      }

      await apiClient.post('/notifications/token', { token }).catch(() => undefined);
      await storageSetItem('unqx.push.last-token', token);
      lastTokenRef.current = token;
    };

    void syncToken();
  }, [token]);

  React.useEffect(() => {
    let cancelled = false;

    const syncSentryUser = async () => {
      if (!signedIn) {
        setSentryUser(null);
        return;
      }

      try {
        const me = await apiClient.get<any>('/me');
        if (cancelled) {
          return;
        }
        const user = me?.user ?? me;
        const id = user?.id;
        const username = user?.slug ?? user?.username ?? user?.fullSlug ?? undefined;
        setSentryUser(id || username ? { id, username } : null);
      } catch (error) {
        if (!cancelled) {
          captureSentryException(error, {
            tags: { area: 'auth', op: 'sentry_user_sync' },
          });
        }
      }
    };

    void syncSentryUser();

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  React.useEffect(() => {
    const loadBiometricSettings = async () => {
      const [enabled, type] = await Promise.all([getBiometricsEnabled(), getBiometricType()]);
      setBiometricEnabled(enabled);
      setBiometricType(type);
    };
    void loadBiometricSettings();
  }, [getBiometricType, getBiometricsEnabled]);

  React.useEffect(() => {
    const listener = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        backgroundAtRef.current = Date.now();
        return;
      }

      if (nextState === 'active' && previousState !== 'active') {
        void (async () => {
          const enabled = await getBiometricsEnabled();
          setBiometricEnabled(enabled);
          if (!signedIn || !enabled) {
            return;
          }
          const lastBackground = backgroundAtRef.current;
          if (!lastBackground) {
            return;
          }
          if (Date.now() - lastBackground > APP_LOCK_AFTER_BACKGROUND_MS) {
            setLockVisible(true);
          }
        })();
      }
    });

    return () => {
      listener.remove();
    };
  }, [getBiometricsEnabled, signedIn]);

  React.useEffect(() => {
    if (!signedIn) {
      setLockVisible(false);
    }
  }, [signedIn]);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={tokens.phoneBg} />
      <OfflineBanner isOnline={isOnline} tokens={tokens} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 250,
          gestureEnabled: true,
          contentStyle: {
            backgroundColor: tokens.bg,
          },
        }}
      />
      <NotificationPermissionPrompt
        visible={promptVisible}
        tokens={tokens}
        onAllow={() => {
          void requestPermissionFromPrompt();
        }}
        onLater={() => {
          void dismissPrompt();
        }}
      />
      <BiometricLockScreen
        visible={signedIn && biometricEnabled && lockVisible}
        tokens={tokens}
        biometricType={biometricType}
        onAuthenticated={() => {
          setLockVisible(false);
          backgroundAtRef.current = null;
        }}
        onOtherMethod={() => {
          void (async () => {
            await signOut();
            setLockVisible(false);
            safeReplace('/login');
          })();
        }}
      />
    </>
  );
}

function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: queryPersistMaxAge,
        }}
      >
        <ErrorBoundary>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </ErrorBoundary>
        <Toast config={toastConfig} />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

export default sentryWrap(RootLayout);
