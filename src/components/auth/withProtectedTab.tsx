import React from 'react';
import { Redirect } from 'expo-router';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThemeContext } from '@/theme/ThemeProvider';

export function withProtectedTab<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  function ProtectedTabComponent(props: P): React.JSX.Element {
    const { tokens } = useThemeContext();
    const { ready, signedIn } = useAuthStatus();

    if (!ready) {
      return <AuthLoadingScreen tokens={tokens} title='Проверка доступа...' />;
    }

    if (!signedIn) {
      return <Redirect href='/login' />;
    }

    return <Component {...props} />;
  }

  ProtectedTabComponent.displayName = `withProtectedTab(${Component.displayName || Component.name || 'Component'})`;
  return ProtectedTabComponent;
}
