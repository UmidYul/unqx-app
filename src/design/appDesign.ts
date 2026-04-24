import { AppDesignTokens, SurfacePreset, ThemeMode } from '@/types';

function surface(
  backgroundColor: string,
  borderColor: string,
  shadowColor: string,
  shadowOpacity: number,
  shadowRadius: number,
  shadowOffsetY: number,
  elevation: number,
): SurfacePreset {
  return {
    backgroundColor,
    borderColor,
    shadowColor,
    shadowOpacity,
    shadowRadius,
    shadowOffsetY,
    elevation,
  };
}

export const LIGHT_APP_DESIGN: AppDesignTokens = {
  mode: 'light',
  backdropStart: '#fcfcfb',
  backdropEnd: '#f2f2f1',
  backdropAccent: 'rgba(17, 17, 17, 0.045)',
  chromeSurface: surface('rgba(247,247,247,0.92)', '#dddddd', '#111111', 0.05, 20, 10, 6),
  elevatedSurface: surface('rgba(255,255,255,0.98)', '#e5e5e5', '#111111', 0.08, 28, 16, 10),
  floatingSurface: surface('rgba(255,255,255,0.94)', '#dfdfdf', '#111111', 0.09, 24, 14, 8),
  authSurface: surface('rgba(255,255,255,0.97)', '#e5e5e5', '#111111', 0.09, 34, 18, 10),
  chipSurface: surface('rgba(255,255,255,0.88)', '#e0e0e0', '#111111', 0.04, 10, 4, 2),
  navSurface: surface('rgba(248,248,248,0.94)', '#dddddd', '#111111', 0.1, 28, 18, 10),
  overlayStroke: 'rgba(17,17,17,0.055)',
  overlayStrokeSoft: 'rgba(17,17,17,0.03)',
  heroGradient: ['#ffffff', '#f7f7f7', '#efefef'],
  panelGradient: ['rgba(255,255,255,0.98)', 'rgba(248,248,248,0.98)'],
  noiseTint: 'rgba(255,255,255,0.16)',
  glowTint: 'rgba(255,255,255,0.72)',
};

export const DARK_APP_DESIGN: AppDesignTokens = {
  mode: 'dark',
  backdropStart: '#0e1014',
  backdropEnd: '#181b20',
  backdropAccent: 'rgba(255,255,255,0.04)',
  chromeSurface: surface('rgba(21,24,30,0.86)', 'rgba(255,255,255,0.10)', '#000000', 0.28, 26, 16, 14),
  elevatedSurface: surface('rgba(28,32,38,0.96)', 'rgba(255,255,255,0.10)', '#000000', 0.3, 30, 18, 16),
  floatingSurface: surface('rgba(24,28,34,0.9)', 'rgba(255,255,255,0.11)', '#000000', 0.34, 30, 18, 16),
  authSurface: surface('rgba(26,30,36,0.96)', 'rgba(255,255,255,0.10)', '#000000', 0.34, 34, 20, 16),
  chipSurface: surface('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.11)', '#000000', 0.12, 12, 5, 4),
  navSurface: surface('rgba(21,24,30,0.94)', 'rgba(255,255,255,0.10)', '#000000', 0.36, 32, 18, 18),
  overlayStroke: 'rgba(255,255,255,0.06)',
  overlayStrokeSoft: 'rgba(255,255,255,0.03)',
  heroGradient: ['#20242b', '#181c22', '#121418'],
  panelGradient: ['rgba(29,33,39,0.98)', 'rgba(19,22,27,0.98)'],
  noiseTint: 'rgba(255,255,255,0.04)',
  glowTint: 'rgba(255,255,255,0.08)',
};

export function resolveAppDesign(mode: ThemeMode): AppDesignTokens {
  return mode === 'dark' ? DARK_APP_DESIGN : LIGHT_APP_DESIGN;
}

export function resolveShadowStyle(preset: SurfacePreset): {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
} {
  return {
    shadowColor: preset.shadowColor,
    shadowOpacity: preset.shadowOpacity,
    shadowRadius: preset.shadowRadius,
    shadowOffset: { width: 0, height: preset.shadowOffsetY },
    elevation: preset.elevation,
  };
}
