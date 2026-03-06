import { ThemeMode, ThemeTokens } from '@/types';

export const LIGHT_TOKENS: ThemeTokens = {
  bg: '#ffffff',
  phoneBg: '#ffffff',
  surface: '#f5f5f5',
  border: '#e8e8e8',
  borderStrong: '#111111',
  text: '#0a0a0a',
  textSub: '#555555',
  textMuted: '#999999',
  accent: '#000000',
  accentText: '#ffffff',
  green: '#16a34a',
  greenBg: '#f0fdf4',
  amber: '#d97706',
  amberBg: '#fffbeb',
  red: '#dc2626',
  blue: '#2563eb',
  blueBg: '#eff6ff',
  tabActiveBg: '#000000',
  tabActiveText: '#ffffff',
  tabInactive: '#aaaaaa',
  navBorder: '#f0f0f0',
  inputBg: '#f5f5f5',
};

export const DARK_TOKENS: ThemeTokens = {
  bg: '#0a0a0a',
  phoneBg: '#111111',
  surface: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: '#e8dfc8',
  text: '#f5f5f5',
  textSub: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.28)',
  accent: '#e8dfc8',
  accentText: '#111111',
  green: '#4ade80',
  greenBg: 'rgba(74,222,128,0.1)',
  amber: '#fbbf24',
  amberBg: 'rgba(251,191,36,0.1)',
  red: '#f87171',
  blue: '#60a5fa',
  blueBg: 'rgba(96,165,250,0.1)',
  tabActiveBg: '#e8dfc8',
  tabActiveText: '#111111',
  tabInactive: 'rgba(255,255,255,0.3)',
  navBorder: 'rgba(255,255,255,0.07)',
  inputBg: 'rgba(255,255,255,0.06)',
};

export const AUTO_THEME_HOURS = {
  darkStart: 20,
  darkEnd: 8,
};

export function resolveThemeByHour(hour: number): ThemeMode {
  if (hour >= AUTO_THEME_HOURS.darkStart || hour < AUTO_THEME_HOURS.darkEnd) {
    return 'dark';
  }

  return 'light';
}
