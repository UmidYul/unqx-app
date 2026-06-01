import React from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { withProtectedTab } from '@/components/auth/withProtectedTab';
import { PublicScreenShell } from '@/components/public/PublicScreenShell';
import { SitePageWebView } from '@/components/public/SitePageWebView';
import { API_ORIGIN } from '@/config/api';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';

function ProfilePage(): React.JSX.Element {
  const { safePush, safeReplace } = useThrottledNavigation();

  return (
    <ErrorBoundary>
      <PublicScreenShell>
        <SitePageWebView
          uri={`${API_ORIGIN}/profile`}
          onOpenHome={() => {
            safeReplace('/(tabs)/home');
          }}
          onOpenProfile={(slug) => {
            safePush(`/(tabs)/people/${slug}`);
          }}
        />
      </PublicScreenShell>
    </ErrorBoundary>
  );
}

export default withProtectedTab(ProfilePage);
