import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PublicScreenShell } from '@/components/public/PublicScreenShell';
import { SitePageWebView } from '@/components/public/SitePageWebView';
import { API_ORIGIN } from '@/config/api';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';

export default function ResidentProfilePage(): React.JSX.Element {
  const { safePush, safeReplace } = useThrottledNavigation();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();

  const slug = React.useMemo(() => {
    const value = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    return String(value ?? '').trim();
  }, [params.slug]);

  const uri = React.useMemo(
    () => (slug ? `${API_ORIGIN}/${encodeURIComponent(slug)}` : API_ORIGIN),
    [slug],
  );

  return (
    <ErrorBoundary>
      <PublicScreenShell>
        <SitePageWebView
          uri={uri}
          onOpenHome={() => {
            safeReplace('/(tabs)/home');
          }}
          onOpenProfile={(nextSlug) => {
            safePush(`/(tabs)/people/${nextSlug}`);
          }}
        />
      </PublicScreenShell>
    </ErrorBoundary>
  );
}
