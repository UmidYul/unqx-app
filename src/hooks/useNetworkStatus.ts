import React from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient, onlineManager } from '@tanstack/react-query';

function resolveOnlineState(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  return Boolean(state.isConnected && (state.isInternetReachable ?? true));
}

export function useNetworkStatus(options?: { invalidateOnReconnect?: boolean }): { isOnline: boolean } {
  const queryClient = useQueryClient();
  const invalidateOnReconnect = options?.invalidateOnReconnect ?? true;
  const [isOnline, setIsOnline] = React.useState(true);
  const wasOfflineRef = React.useRef(false);

  React.useEffect(() => {
    let isMounted = true;

    const applyOnlineState = (online: boolean) => {
      if (!isMounted) {
        return;
      }
      setIsOnline(online);
      onlineManager.setOnline(online);

      if (invalidateOnReconnect && wasOfflineRef.current && online) {
        void queryClient.invalidateQueries();
      }

      wasOfflineRef.current = !online;
    };

    NetInfo.fetch()
      .then((state) => {
        applyOnlineState(resolveOnlineState(state));
      })
      .catch(() => {
        applyOnlineState(true);
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      applyOnlineState(resolveOnlineState(state));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [invalidateOnReconnect, queryClient]);

  return { isOnline };
}
