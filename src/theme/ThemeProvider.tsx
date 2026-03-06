import React, { createContext, useContext, useMemo } from 'react';

import { useTheme, UseThemeResult } from '@/hooks/useTheme';

const ThemeContext = createContext<UseThemeResult | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const themeState = useTheme();
  const value = useMemo(() => themeState, [themeState]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): UseThemeResult {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useThemeContext must be used inside ThemeProvider');
  }

  return value;
}
