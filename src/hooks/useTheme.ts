import { useCallback, useEffect, useMemo, useState } from 'react';

import { storageGetItem, storageSetItem } from '@/lib/secureStorage';
import { ThemeMode } from '@/types';
import { DARK_TOKENS, LIGHT_TOKENS, getUzbekistanHour, resolveThemeByHour } from '@/theme/tokens';

const THEME_KEY = 'unqx.theme.mode';
const AUTO_THEME_KEY = 'unqx.theme.auto';

async function loadStoredValue(key: string): Promise<string | null> {
  try {
    return await storageGetItem(key);
  } catch {
    return null;
  }
}

async function saveStoredValue(key: string, value: string): Promise<void> {
  try {
    await storageSetItem(key, value);
  } catch {
    // noop
  }
}

export interface UseThemeResult {
  theme: ThemeMode;
  autoTheme: boolean;
  tokens: typeof LIGHT_TOKENS;
  setTheme: (mode: ThemeMode) => void;
  setAutoTheme: (enabled: boolean) => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [autoTheme, setAutoThemeState] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function hydrate(): Promise<void> {
      const [storedTheme, storedAuto] = await Promise.all([
        loadStoredValue(THEME_KEY),
        loadStoredValue(AUTO_THEME_KEY),
      ]);

      if (!mounted) return;

      const isAutoEnabled = storedAuto === '1';
      setAutoThemeState(isAutoEnabled);

      if (isAutoEnabled) {
        setThemeState(resolveThemeByHour(getUzbekistanHour()));
        return;
      }

      if (storedTheme === 'dark' || storedTheme === 'light') {
        setThemeState(storedTheme);
      }
    }

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!autoTheme) {
      return;
    }

    const applyAutoTheme = (): void => {
      setThemeState(resolveThemeByHour(getUzbekistanHour()));
    };

    applyAutoTheme();

    const timerId = setInterval(applyAutoTheme, 60 * 1000);

    return () => clearInterval(timerId);
  }, [autoTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setAutoThemeState(false);
    void saveStoredValue(AUTO_THEME_KEY, '0');
    setThemeState(mode);
    void saveStoredValue(THEME_KEY, mode);
  }, []);

  const setAutoTheme = useCallback((enabled: boolean) => {
    setAutoThemeState(enabled);
    void saveStoredValue(AUTO_THEME_KEY, enabled ? '1' : '0');

    if (enabled) {
      const autoMode = resolveThemeByHour(getUzbekistanHour());
      setThemeState(autoMode);
      void saveStoredValue(THEME_KEY, autoMode);
    }
  }, []);

  const tokens = useMemo(() => (theme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS), [theme]);

  return {
    theme,
    autoTheme,
    tokens,
    setTheme,
    setAutoTheme,
  };
}
