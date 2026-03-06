import React from 'react';
import { useRouter } from 'expo-router';

import { addSentryBreadcrumb } from '@/lib/sentry';
import { runSafelyWithLock, runThrottled } from '@/utils/navigation';

export function useThrottledNavigation(): {
  navigate: (fn: () => void) => void;
  safePush: (href: string) => void;
  safeReplace: (href: string) => void;
  safeBack: () => void;
} {
  const router = useRouter();

  const navigate = React.useCallback((fn: () => void) => {
    runThrottled(fn, 500);
  }, []);

  const safePush = React.useCallback(
    (href: string) => {
      runThrottled(() => {
        runSafelyWithLock(() => {
          addSentryBreadcrumb({
            category: 'navigation',
            message: `Navigate to ${href}`,
          });
          router.push(href as never);
        }, 500);
      }, 500);
    },
    [router],
  );

  const safeReplace = React.useCallback(
    (href: string) => {
      runThrottled(() => {
        runSafelyWithLock(() => {
          addSentryBreadcrumb({
            category: 'navigation',
            message: `Navigate to ${href}`,
          });
          router.replace(href as never);
        }, 500);
      }, 500);
    },
    [router],
  );

  const safeBack = React.useCallback(() => {
    runThrottled(() => {
      runSafelyWithLock(() => {
        addSentryBreadcrumb({
          category: 'navigation',
          message: 'Navigate back',
        });
        router.back();
      }, 500);
    }, 500);
  }, [router]);

  return { navigate, safePush, safeReplace, safeBack };
}
