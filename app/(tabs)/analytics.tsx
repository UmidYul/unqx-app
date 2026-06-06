import React from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { withProtectedTab } from '@/components/auth/withProtectedTab';
import { PublicScreenShell } from '@/components/public/PublicScreenShell';
import { SitePageWebView } from '@/components/public/SitePageWebView';
import { API_ORIGIN } from '@/config/api';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { markPushTrigger } from '@/lib/pushPrompt';

const OPEN_PROFILE_ANALYTICS_INJECTION = `
  (function() {
    var activated = false;
    var attempts = 0;
    var maxAttempts = 40;
    var delayMs = 250;

    function normalizeText(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/\\s+/g, ' ')
        .trim();
    }

    function isBareProfilePath() {
      var pathname = window.location && window.location.pathname ? window.location.pathname : '';
      return /^\\/profile\\/?$/i.test(pathname);
    }

    function isAnalyticsLabel(value) {
      var text = normalizeText(value);
      return text.indexOf('analytics') !== -1
        || text.indexOf('analitika') !== -1
        || text.indexOf('аналит') !== -1
        || text.indexOf('statistika') !== -1
        || text.indexOf('статист') !== -1;
    }

    function pushUnique(list, node) {
      if (!node || list.indexOf(node) !== -1) {
        return;
      }
      list.push(node);
    }

    function collectCandidates() {
      var candidates = [];
      var selectors = [
        '[data-profile-tab="analytics"]',
        '[data-tab="analytics"]',
        '[data-section="analytics"]',
        '[data-screen="analytics"]',
        '[aria-controls*="analytics"]',
        '[href*="tab=analytics"]',
        '[href*="section=analytics"]',
        '[href*="#analytics"]',
        '[href*="/analytics"]'
      ];

      for (var i = 0; i < selectors.length; i += 1) {
        var nodes = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < nodes.length; j += 1) {
          pushUnique(candidates, nodes[j]);
        }
      }

      var interactiveNodes = document.querySelectorAll('a, button, [role="button"]');
      for (var k = 0; k < interactiveNodes.length; k += 1) {
        var node = interactiveNodes[k];
        var text = normalizeText(node.textContent || node.getAttribute('aria-label') || '');
        if (isAnalyticsLabel(text)) {
          pushUnique(candidates, node);
        }
      }

      return candidates;
    }

    function activateCandidate(node) {
      if (!node || activated) {
        return false;
      }

      activated = true;

      try {
        node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      } catch (_error) {}

      try {
        node.click();
      } catch (_error) {}

      var href = node.getAttribute ? node.getAttribute('href') : '';
      if (href && href !== '#' && href.indexOf('javascript:') !== 0) {
        try {
          window.location.href = href;
        } catch (_error) {}
      }

      return true;
    }

    function tryOpenAnalytics() {
      if (!isBareProfilePath()) {
        return true;
      }

      var candidates = collectCandidates();
      for (var i = 0; i < candidates.length; i += 1) {
        if (activateCandidate(candidates[i])) {
          return true;
        }
      }

      return false;
    }

    function scheduleRetry() {
      if (activated) {
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        return;
      }
      window.setTimeout(run, delayMs);
    }

    function run() {
      if (!tryOpenAnalytics()) {
        scheduleRetry();
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    var observer = new MutationObserver(function() {
      if (activated) {
        observer.disconnect();
        return;
      }
      if (tryOpenAnalytics()) {
        observer.disconnect();
      }
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.setTimeout(function() {
        observer.disconnect();
      }, maxAttempts * delayMs + 1000);
    }

    true;
  })();
`;

function AnalyticsPage(): React.JSX.Element {
  const { safePush, safeReplace } = useThrottledNavigation();

  React.useEffect(() => {
    void markPushTrigger('analytics').catch(() => undefined);
  }, []);

  return (
    <ErrorBoundary>
      <PublicScreenShell>
        <SitePageWebView
          uri={`${API_ORIGIN}/profile`}
          extraInjectedJavaScript={OPEN_PROFILE_ANALYTICS_INJECTION}
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

export default withProtectedTab(AnalyticsPage);
