import React from 'react';

import { useAuth } from '@/hooks/useAuth';

interface AuthStatusState {
  ready: boolean;
  signedIn: boolean;
}

export function useAuthStatus(): AuthStatusState {
  const { isLoading, isAuthenticated } = useAuth();
  return {
    ready: !isLoading,
    signedIn: isAuthenticated,
  };
}
