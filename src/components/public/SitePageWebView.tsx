import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { API_ORIGIN } from '@/config/api';
import { toast } from '@/utils/toast';

import { getSiteProfileSlug, isExternalSchemeUrl, isSameSiteUrl, isSiteHomeUrl, toAbsoluteSiteUrl } from './siteNavigation';

interface SitePageWebViewProps {
  uri?: string;
  onOpenProfile: (slug: string) => void;
  onOpenHome?: () => void;
  extraInjectedJavaScript?: string;
}

const RETARGET_BLANK_INJECTION = `
  (function() {
    var retarget = function() {
      var nodes = document.querySelectorAll('a[target="_blank"]');
      for (var index = 0; index < nodes.length; index += 1) {
        nodes[index].setAttribute('target', '_self');
      }
    };
    retarget();
    var observer = new MutationObserver(retarget);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.open = function(url) {
      if (url) {
        window.location.href = url;
      }
      return null;
    };
    true;
  })();
`;

export function SitePageWebView({
  uri = API_ORIGIN,
  onOpenProfile,
  onOpenHome,
  extraInjectedJavaScript,
}: SitePageWebViewProps): React.JSX.Element {
  const [currentUrl, setCurrentUrl] = React.useState(uri);
  const [loading, setLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const injectedJavaScript = React.useMemo(
    () => [RETARGET_BLANK_INJECTION, extraInjectedJavaScript].filter(Boolean).join('\n'),
    [extraInjectedJavaScript],
  );

  const handleOpenExternal = React.useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error('Не удалось открыть ссылку');
    }
  }, []);

  const handleShouldStartLoad = React.useCallback((request: { url: string }) => {
    const absolute = toAbsoluteSiteUrl(request.url);
    if (!absolute) {
      return false;
    }

    if (onOpenHome && isSiteHomeUrl(absolute) && absolute !== currentUrl) {
      onOpenHome();
      return false;
    }

    const slug = getSiteProfileSlug(absolute);
    if (slug && slug !== getSiteProfileSlug(currentUrl)) {
      onOpenProfile(slug);
      return false;
    }

    if (isExternalSchemeUrl(absolute)) {
      void handleOpenExternal(absolute);
      return false;
    }

    if (!isSameSiteUrl(absolute)) {
      void handleOpenExternal(absolute);
      return false;
    }

    setCurrentUrl(absolute);
    return true;
  }, [currentUrl, handleOpenExternal, onOpenHome, onOpenProfile]);

  return (
    <View style={styles.container}>
      <WebView
        key={currentUrl}
        source={{ uri: currentUrl }}
        style={styles.webview}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadStart={() => {
          setLoading(true);
          setHasError(false);
        }}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setHasError(true);
          setLoading(false);
        }}
        injectedJavaScript={injectedJavaScript}
        setSupportMultipleWindows={false}
        startInLoadingState={false}
      />

      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator size='small' color='#111111' />
        </View>
      ) : null}

      {hasError ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Не удалось открыть сайт.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  overlayText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555555',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
