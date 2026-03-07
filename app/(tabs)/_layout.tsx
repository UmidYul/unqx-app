import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThemeContext } from '@/theme/ThemeProvider';

export default function TabsLayout(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const { ready, signedIn } = useAuthStatus();

  if (!ready) {
    return <AuthLoadingScreen tokens={tokens} title='Проверка доступа...' />;
  }

  if (!signedIn) {
    return <Redirect href='/login' />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 240,
        gestureEnabled: true,
        contentStyle: {
          backgroundColor: tokens.phoneBg,
        },
      }}
    />
  );
}
