import React from 'react';
import { Redirect } from 'expo-router';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThemeContext } from '@/theme/ThemeProvider';

export default function TabsIndex(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const { ready, signedIn } = useAuthStatus();

  if (!ready) {
    return <AuthLoadingScreen tokens={tokens} title='Проверка доступа...' />;
  }

  return <Redirect href={signedIn ? '/(tabs)/home' : '/(tabs)/nfc'} />;
}
