import React from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PublicScreenShell } from '@/components/public/PublicScreenShell';
import { SitePageWebView } from '@/components/public/SitePageWebView';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';

export default function HomePage(): React.JSX.Element {
  const { safePush } = useThrottledNavigation();

  return (
    <ErrorBoundary>
      <PublicScreenShell>
        <SitePageWebView
          onOpenProfile={(slug) => {
            safePush(`/(tabs)/people/${slug}`);
          }}
        />
      </PublicScreenShell>
    </ErrorBoundary>
  );
}
