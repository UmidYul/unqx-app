import { ThemeMode, ThemeTokens } from '@/types';

export const LIGHT_TOKENS: ThemeTokens = {
  bg: '#fcfcfb',
  phoneBg: '#f7f7f7',
  surface: '#ffffff',
  surfaceElevated: '#fbfbfa',
  surfaceMuted: 'rgba(248,248,248,0.92)',
  border: '#e5e5e5',
  borderStrong: '#d2d2d2',
  text: '#171717',
  textSub: '#525252',
  textMuted: '#8b8b8b',
  accent: '#121417',
  accentText: '#ffffff',
  green: '#1f8b5b',
  greenBg: 'rgba(31,139,91,0.10)',
  amber: '#b7791f',
  amberBg: 'rgba(183,121,31,0.10)',
  red: '#cb4c3c',
  blue: '#3f6bcc',
  blueBg: 'rgba(63,107,204,0.10)',
  tabActiveBg: '#121417',
  tabActiveText: '#ffffff',
  tabInactive: '#7a7a7a',
  navBorder: '#dddddd',
  inputBg: 'rgba(255,255,255,0.96)',
  glass: 'rgba(247,247,247,0.92)',
  glassBorder: '#dddddd',
  cardShadowColor: '#111111',
  pageTint: 'rgba(17,17,17,0.05)',
  overlayLine: 'rgba(17,17,17,0.06)',
  overlaySoft: 'rgba(17,17,17,0.035)',
  heroGradient: ['#ffffff', '#f7f7f7', '#efefef'],
  panelGradient: ['rgba(255,255,255,0.98)', 'rgba(248,248,248,0.98)'],
};

export const DARK_TOKENS: ThemeTokens = {
  bg: '#0f1114',
  phoneBg: '#111317',
  surface: 'rgba(24,27,33,0.92)',
  surfaceElevated: 'rgba(30,34,40,0.96)',
  surfaceMuted: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#f5f5f5',
  textSub: 'rgba(245,245,245,0.74)',
  textMuted: 'rgba(245,245,245,0.48)',
  accent: '#f3f2ec',
  accentText: '#121417',
  green: '#63c790',
  greenBg: 'rgba(99,199,144,0.14)',
  amber: '#f0c064',
  amberBg: 'rgba(240,192,100,0.14)',
  red: '#ff8e7f',
  blue: '#92b6ff',
  blueBg: 'rgba(146,182,255,0.14)',
  tabActiveBg: '#f3f2ec',
  tabActiveText: '#121417',
  tabInactive: 'rgba(245,245,245,0.46)',
  navBorder: 'rgba(255,255,255,0.10)',
  inputBg: 'rgba(255,255,255,0.06)',
  glass: 'rgba(24,27,33,0.84)',
  glassBorder: 'rgba(255,255,255,0.12)',
  cardShadowColor: '#000000',
  pageTint: 'rgba(255,255,255,0.05)',
  overlayLine: 'rgba(255,255,255,0.07)',
  overlaySoft: 'rgba(255,255,255,0.035)',
  heroGradient: ['#1f242b', '#181c22', '#121418'],
  panelGradient: ['rgba(27,31,37,0.98)', 'rgba(19,22,27,0.98)'],
};

export const AUTO_THEME_HOURS = {
  darkStart: 20,
  darkEnd: 8,
};

export const UZBEKISTAN_UTC_OFFSET_HOURS = 5;

export function getUzbekistanHour(date: Date = new Date()): number {
  return (date.getUTCHours() + UZBEKISTAN_UTC_OFFSET_HOURS) % 24;
}

export function getUzbekistanWeekday(date: Date = new Date()): number {
  const uzbDate = new Date(date.getTime() + UZBEKISTAN_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return uzbDate.getUTCDay();
}

export function resolveThemeByHour(hour: number): ThemeMode {
  if (hour >= AUTO_THEME_HOURS.darkStart || hour < AUTO_THEME_HOURS.darkEnd) {
    return 'dark';
  }

  return 'light';
}

function parseColorChannel(input: string): number {
  return Math.max(0, Math.min(255, Number.parseInt(input, 16) || 0));
}

function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const raw = String(color || '').trim();
  const hexMatch = raw.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseColorChannel(hex.slice(0, 2)),
      g: parseColorChannel(hex.slice(2, 4)),
      b: parseColorChannel(hex.slice(4, 6)),
    };
  }

  const rgbMatch = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, Number(rgbMatch[1]) || 0)),
      g: Math.max(0, Math.min(255, Number(rgbMatch[2]) || 0)),
      b: Math.max(0, Math.min(255, Number(rgbMatch[3]) || 0)),
    };
  }

  return null;
}

export function isDarkThemeTokens(tokens: Pick<ThemeTokens, 'bg'>): boolean {
  const rgb = parseRgb(tokens.bg);
  if (!rgb) {
    return false;
  }

  const luminance = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
  return luminance < 0.5;
}
