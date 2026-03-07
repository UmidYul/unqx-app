import React from 'react';
import { Stack } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
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
import { LanguageProvider } from '@/i18n/LanguageProvider';
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

function RootNavigator(): React.JSX.Element {
  const { theme, tokens, autoTheme } = useThemeContext();
  const { signedIn } = useAuthStatus();
  const { safeReplace } = useThrottledNavigation();
  const { getBiometricsEnabled, getBiometricType, getBiometricLockTimeoutMs } = useBiometrics();
  const { isOnline } = useNetworkStatus();
  const { token, nativeToken, promptVisible, requestPermissionFromPrompt, dismissPrompt } = usePushNotifications();
  const storeTheme = useNfcStore((state) => state.theme);
  const storeAutoTheme = useNfcStore((state) => state.autoTheme);
  const setTheme = useNfcStore((state) => state.setTheme);
  const setAutoTheme = useNfcStore((state) => state.setAutoTheme);
  const lastTokenRef = React.useRef<string | null>(null);
  const pushedTokenRef = React.useRef<string | null>(null);
  const appStateRef = React.useRef(AppState.currentState);
  const backgroundAtRef = React.useRef<number | null>(null);
  const [lockVisible, setLockVisible] = React.useState(false);
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<BiometricType>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const applyImmersiveMode = async () => {
      try {
        await NavigationBar.setPositionAsync('absolute');
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setBackgroundColorAsync('#00000000');
        await NavigationBar.setVisibilityAsync('hidden');
      } catch {
        // noop
      }
    };

    void applyImmersiveMode();
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void applyImmersiveMode();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, []);

  React.useEffect(() => {
    if (storeTheme !== theme) {
      setTheme(theme);
    }
    if (storeAutoTheme !== autoTheme) {
      setAutoTheme(autoTheme);
    }
  }, [autoTheme, setAutoTheme, setTheme, storeAutoTheme, storeTheme, theme]);

  React.useEffect(() => {
    if (!signedIn) {
      lastTokenRef.current = null;
      pushedTokenRef.current = null;
      return;
    }

    const syncToken = async () => {
      if (!token) {
        return;
      }
      const payloadKey = `${token ?? ''}|${nativeToken ?? ''}`;
      if (pushedTokenRef.current === payloadKey) {
        return;
      }

      try {
        await apiClient.post('/notifications/token', {
          token,
          expoToken: token,
          deviceToken: nativeToken,
          platform: Platform.OS,
        });
      } catch {
        return;
      }
      await storageSetItem('unqx.push.last-token', token ?? nativeToken ?? '');
      lastTokenRef.current = token ?? nativeToken ?? null;
      pushedTokenRef.current = payloadKey;
    };

    void syncToken();
  }, [nativeToken, signedIn, token]);

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
      const [enabled, type] = await Promise.all([
        getBiometricsEnabled(),
        getBiometricType(),
      ]);
      setBiometricEnabled(enabled);
      setBiometricType(type);
    };
    void loadBiometricSettings();
  }, [getBiometricLockTimeoutMs, getBiometricType, getBiometricsEnabled]);

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
          const [enabled, timeoutMs] = await Promise.all([
            getBiometricsEnabled(),
            getBiometricLockTimeoutMs(),
          ]);
          setBiometricEnabled(enabled);
          if (!signedIn || !enabled) {
            return;
          }
          const lastBackground = backgroundAtRef.current;
          if (!lastBackground) {
            return;
          }
          if (Date.now() - lastBackground > timeoutMs) {
            setLockVisible(true);
          }
        })();
      }
    });

    return () => {
      listener.remove();
    };
  }, [getBiometricLockTimeoutMs, getBiometricsEnabled, signedIn]);

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
          animation: 'fade',
          animationDuration: 260,
          gestureEnabled: true,
          contentStyle: {
            backgroundColor: tokens.phoneBg,
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
          <LanguageProvider>
            <ThemeProvider>
              <RootNavigator />
            </ThemeProvider>
          </LanguageProvider>
        </ErrorBoundary>
        <Toast config={toastConfig} />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

export default sentryWrap(RootLayout);
