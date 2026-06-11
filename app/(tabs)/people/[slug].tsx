import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PublicScreenShell } from '@/components/public/PublicScreenShell';
import { SitePageWebView } from '@/components/public/SitePageWebView';
import { API_ORIGIN } from '@/config/api';
import { buildNavThemeFromCardSpec, resolveProfileCardTheme } from '@/design/cardThemes';
import { fetchResidentProfileLike } from '@/services/mobileApi';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';

type CardNavTheme = ReturnType<typeof buildNavThemeFromCardSpec>;

export default function ResidentProfilePage(): React.JSX.Element {
  const { safePush, safeReplace } = useThrottledNavigation();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const [navTheme, setNavTheme] = React.useState<CardNavTheme | null>(null);

  const slug = React.useMemo(() => {
    const value = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    return String(value ?? '').trim();
  }, [params.slug]);

  const uri = React.useMemo(
    () => (slug ? `${API_ORIGIN}/${encodeURIComponent(slug)}` : API_ORIGIN),
    [slug],
  );

  React.useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetchResidentProfileLike(slug)
      .then((profile) => {
        if (cancelled || !profile.theme) return;
        const spec = resolveProfileCardTheme(profile.theme);
        if (!cancelled) setNavTheme(buildNavThemeFromCardSpec(spec));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <ErrorBoundary>
      <PublicScreenShell themeOverride={navTheme}>
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
