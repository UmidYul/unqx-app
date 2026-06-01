import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { API_ORIGIN } from '@/config/api';
import { toast } from '@/utils/toast';

import { getSiteProfileSlug, isExternalSchemeUrl, isSameSiteUrl, toAbsoluteSiteUrl } from './siteNavigation';

interface EmbeddedPublicCardWebViewProps {
  slug: string;
  activeTab?: 'card' | 'posts';
  onOpenProfile: (slug: string) => void;
  onShareCard?: () => void;
  onSaveContact?: () => void;
  onOpenCard?: () => void;
  onOpenPosts?: () => void;
}

interface EmbeddedMessagePayload {
  type?: 'height' | 'share_card' | 'save_contact' | 'open_posts' | 'open_card';
  height?: number;
}

function buildSetupScript(initialTab: 'card' | 'posts'): string {
  return `
    (function() {
      var initialTab = ${JSON.stringify(initialTab)};
      var boot = function() {
        if (window.__UNQX_RN_CARD__ && typeof window.__UNQX_RN_CARD__.applyState === 'function') {
          window.__UNQX_RN_CARD__.applyState(initialTab);
          window.__UNQX_RN_CARD__.scheduleReport();
          true;
          return;
        }

        var post = function(payload) {
          if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') {
            return;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        };

        var lastHeight = 0;
        var framePending = false;
        window.__UNQX_RN_ACTIVE_TAB__ = initialTab;

        var ensureStyle = function() {
          var existing = document.getElementById('unqx-rn-card-style');
          if (existing) {
            return;
          }

          var style = document.createElement('style');
          style.id = 'unqx-rn-card-style';
          style.textContent = [
            'html, body { margin: 0 !important; padding: 0 !important; background: transparent !important; overflow-x: hidden !important; }',
            'html, body, #__next { min-height: auto !important; height: auto !important; }',
            'body { min-height: 0 !important; }',
            'main { min-height: 0 !important; height: auto !important; display: block !important; justify-content: flex-start !important; padding: 0 12px 12px !important; box-sizing: border-box !important; }',
            '#public-card-layout, #card-view-root, [data-card-view], .unq-ref-shell, .unq-ref-top { width: 100% !important; max-width: none !important; box-sizing: border-box !important; min-height: 0 !important; height: auto !important; padding-bottom: 0 !important; }',
            '#public-card-layout > .mb-3 > a[href="/"] { display: none !important; }',
            '#card-slug-search-form { margin-left: 0 !important; width: 100% !important; max-width: none !important; }',
            '.unq-wall-posts, .unq-wall-more-btn, .unq-follow-dialog, [data-follows-dialog] { display: none !important; }',
            'html[data-unqx-rn-tab="card"] [data-card-tab-panel="card"] { display: block !important; }',
            'html[data-unqx-rn-tab="posts"] [data-card-tab-panel="card"] { display: none !important; }',
            '[data-card-tab-panel="posts"] { display: none !important; }',
            '.unq-ref-shell { margin: 0 !important; }',
            '.unq-ref-top { margin-top: 0 !important; }',
            '.unq-ref-footline { margin-bottom: 0 !important; padding-bottom: 0 !important; }'
          ].join('\\n');
          document.head.appendChild(style);
        };

        var applyState = function(nextTab) {
          var activeTab = nextTab === 'posts' ? 'posts' : 'card';
          window.__UNQX_RN_ACTIVE_TAB__ = activeTab;
          document.documentElement.setAttribute('data-unqx-rn-tab', activeTab);

          var cardPanel = document.querySelector('[data-card-tab-panel="card"]');
          if (cardPanel instanceof HTMLElement) {
            var showCardPanel = activeTab === 'card';
            cardPanel.hidden = !showCardPanel;
            cardPanel.classList.toggle('is-active', showCardPanel);
            cardPanel.style.display = showCardPanel ? 'block' : 'none';
          }

          var postsPanel = document.querySelector('[data-card-tab-panel="posts"]');
          if (postsPanel instanceof HTMLElement) {
            postsPanel.hidden = true;
            postsPanel.classList.remove('is-active');
            postsPanel.style.display = 'none';
          }

          var cardTab = document.querySelector('[data-card-tab="card"]');
          if (cardTab instanceof HTMLElement) {
            var cardActive = activeTab === 'card';
            cardTab.setAttribute('aria-selected', cardActive ? 'true' : 'false');
            cardTab.classList.toggle('is-active', cardActive);
          }

          var postsTab = document.querySelector('[data-card-tab="posts"]');
          if (postsTab instanceof HTMLElement) {
            var postsActive = activeTab === 'posts';
            postsTab.setAttribute('aria-selected', postsActive ? 'true' : 'false');
            postsTab.classList.toggle('is-active', postsActive);
          }
        };

        var retargetAnchors = function() {
          var nodes = document.querySelectorAll('a[target="_blank"]');
          for (var index = 0; index < nodes.length; index += 1) {
            nodes[index].setAttribute('target', '_self');
          }
        };

        var reportHeight = function() {
          framePending = false;
          ensureStyle();
          applyState(window.__UNQX_RN_ACTIVE_TAB__);
          retargetAnchors();

          var root = document.querySelector('[data-card-view]') || document.getElementById('card-view-root') || document.getElementById('public-card-layout') || document.body;
          if (!(root instanceof HTMLElement)) {
            return;
          }

          var rootRect = root.getBoundingClientRect ? root.getBoundingClientRect() : null;
          var activeTab = window.__UNQX_RN_ACTIVE_TAB__ === 'posts' ? 'posts' : 'card';
          var primaryTarget = activeTab === 'posts'
            ? (document.querySelector('.unq-wall-tabs')
              || document.querySelector('[data-card-tab="posts"]')
              || document.querySelector('.unq-ref-social-stats')
              || root)
            : (document.querySelector('.unq-ref-footline')
              || document.querySelector('[data-save-contact]')
              || document.querySelector('[data-card-tab-panel="card"]')
              || root);

          var nextHeight = 0;
          if (primaryTarget instanceof HTMLElement && rootRect) {
            var targetRect = primaryTarget.getBoundingClientRect();
            nextHeight = Math.max(0, targetRect.bottom - rootRect.top);
          }

          if (!nextHeight) {
            nextHeight = Math.max(
              root.offsetHeight || 0,
              root.getBoundingClientRect ? root.getBoundingClientRect().height || 0 : 0
            );
          }

          if (Math.abs(nextHeight - lastHeight) < 8) {
            return;
          }

          lastHeight = nextHeight;
          post({
            type: 'height',
            height: Math.ceil(nextHeight + 8),
          });
        };

        var scheduleReport = function() {
          if (framePending) {
            return;
          }
          framePending = true;
          if (window.requestAnimationFrame) {
            window.requestAnimationFrame(reportHeight);
            return;
          }
          setTimeout(reportHeight, 16);
        };

        window.__UNQX_RN_CARD__ = {
          applyState: applyState,
          scheduleReport: scheduleReport,
        };

        document.addEventListener('click', function(event) {
          var target = event.target instanceof Element ? event.target : null;
          if (!target) {
            return;
          }

          var stopTap = function() {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
              event.stopImmediatePropagation();
            }
          };

          var cardTab = target.closest('[data-card-tab="card"]');
          if (cardTab) {
            stopTap();
            post({ type: 'open_card' });
            return false;
          }

          var postsTab = target.closest('[data-card-tab="posts"]');
          if (postsTab) {
            stopTap();
            post({ type: 'open_posts' });
            return false;
          }

          var shareButton = target.closest('[data-share-card]');
          if (shareButton) {
            stopTap();
            post({ type: 'share_card' });
            return false;
          }

          var saveButton = target.closest('[data-save-contact]');
          if (saveButton) {
            stopTap();
            post({ type: 'save_contact' });
            return false;
          }
        }, true);

        window.open = function(url) {
          if (url) {
            window.location.href = url;
          }
          return null;
        };

        var bindImageLoad = function() {
          var images = document.images || [];
          for (var index = 0; index < images.length; index += 1) {
            images[index].addEventListener('load', scheduleReport, { once: true });
            images[index].addEventListener('error', scheduleReport, { once: true });
          }
        };

        document.addEventListener('DOMContentLoaded', scheduleReport);
        window.addEventListener('load', scheduleReport);
        window.addEventListener('resize', scheduleReport);
        window.addEventListener('load', bindImageLoad);
        setTimeout(scheduleReport, 120);
        setTimeout(scheduleReport, 420);
        setTimeout(scheduleReport, 900);
        setTimeout(scheduleReport, 1600);
        applyState(initialTab);
        scheduleReport();
      };

      boot();
      true;
    })();
  `;
}

function buildTabUpdateScript(activeTab: 'card' | 'posts'): string {
  return `
    (function() {
      if (window.__UNQX_RN_CARD__ && typeof window.__UNQX_RN_CARD__.applyState === 'function') {
        window.__UNQX_RN_CARD__.applyState(${JSON.stringify(activeTab)});
        if (typeof window.__UNQX_RN_CARD__.scheduleReport === 'function') {
          window.__UNQX_RN_CARD__.scheduleReport();
        }
      }
      true;
    })();
  `;
}

export function EmbeddedPublicCardWebView({
  slug,
  activeTab = 'card',
  onOpenProfile,
  onShareCard,
  onSaveContact,
  onOpenCard,
  onOpenPosts,
}: EmbeddedPublicCardWebViewProps): React.JSX.Element {
  const webViewRef = React.useRef<WebView>(null);
  const [height, setHeight] = React.useState(620);
  const setupScript = React.useMemo(() => buildSetupScript(activeTab), [activeTab]);
  const tabUpdateScript = React.useMemo(() => buildTabUpdateScript(activeTab), [activeTab]);

  React.useEffect(() => {
    if (!webViewRef.current) {
      return;
    }
    webViewRef.current.injectJavaScript(tabUpdateScript);
  }, [tabUpdateScript]);

  const handleOpenExternal = React.useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error('Не удалось открыть ссылку');
    }
  }, []);

  const handleMessage = React.useCallback((event: WebViewMessageEvent) => {
    let payload: EmbeddedMessagePayload | null = null;
    try {
      payload = JSON.parse(event.nativeEvent.data) as EmbeddedMessagePayload;
    } catch {
      payload = null;
    }

    if (!payload?.type) {
      return;
    }

    if (payload.type === 'height' && Number.isFinite(payload.height)) {
      const nextHeight = Math.max(280, Math.ceil(Number(payload.height)));
      setHeight((current) => (Math.abs(current - nextHeight) > 2 ? nextHeight : current));
      return;
    }

    if (payload.type === 'share_card') {
      onShareCard?.();
      return;
    }

    if (payload.type === 'save_contact') {
      onSaveContact?.();
      return;
    }

    if (payload.type === 'open_card') {
      onOpenCard?.();
      return;
    }

    if (payload.type === 'open_posts') {
      onOpenPosts?.();
    }
  }, [onOpenCard, onOpenPosts, onSaveContact, onShareCard]);

  const handleShouldStartLoad = React.useCallback((request: { url: string }) => {
    const absolute = toAbsoluteSiteUrl(request.url);
    if (!absolute) {
      return false;
    }

    if (absolute === `${API_ORIGIN}/${encodeURIComponent(slug)}` || absolute === `${API_ORIGIN}/${slug}`) {
      return true;
    }

    const profileSlug = getSiteProfileSlug(absolute);
    if (profileSlug) {
      onOpenProfile(profileSlug);
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

    return false;
  }, [handleOpenExternal, onOpenProfile, slug]);

  return (
    <View style={[styles.cardContainer, { minHeight: height }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: `${API_ORIGIN}/${encodeURIComponent(slug)}` }}
        style={[styles.webview, { height }]}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onMessage={handleMessage}
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(tabUpdateScript);
        }}
        injectedJavaScriptBeforeContentLoaded={setupScript}
        injectedJavaScript={setupScript}
        scrollEnabled={false}
        bounces={false}
        nestedScrollEnabled={false}
        setSupportMultipleWindows={false}
        startInLoadingState={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  webview: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
