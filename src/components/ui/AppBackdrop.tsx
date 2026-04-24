import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';

import { useThemeContext } from '@/theme/ThemeProvider';

interface AppBackdropProps {
  style?: StyleProp<ViewStyle>;
  themeOverride?: {
    backdropStart?: string;
    backdropEnd?: string;
    backdropAccent?: string;
    backdropGlow?: string;
    overlayStroke?: string;
    overlayStrokeSoft?: string;
  } | null;
}

const GRID_COLUMNS = Array.from({ length: 11 }, (_, index) => 40 * index);
const GRID_ROWS = Array.from({ length: 24 }, (_, index) => 40 * index);

export function AppBackdrop({ style, themeOverride }: AppBackdropProps): React.JSX.Element {
  const { design } = useThemeContext();

  return (
    <View pointerEvents='none' style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient
        colors={[
          themeOverride?.backdropStart ?? design.backdropStart,
          themeOverride?.backdropEnd ?? design.backdropEnd,
        ]}
        style={StyleSheet.absoluteFill}
      />
      <Svg viewBox='0 0 400 920' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
        <Circle cx='328' cy='142' r='176' fill={themeOverride?.backdropGlow ?? design.glowTint} />
        <Circle cx='64' cy='824' r='214' fill={themeOverride?.backdropAccent ?? design.backdropAccent} />
        {GRID_COLUMNS.map((x) => (
          <Line
            key={`grid-col-${x}`}
            x1={x}
            y1='0'
            x2={x}
            y2='920'
            stroke={themeOverride?.overlayStrokeSoft ?? design.overlayStrokeSoft}
            strokeWidth='1'
          />
        ))}
        {GRID_ROWS.map((y) => (
          <Line
            key={`grid-row-${y}`}
            x1='0'
            y1={y}
            x2='400'
            y2={y}
            stroke={themeOverride?.overlayStrokeSoft ?? design.overlayStrokeSoft}
            strokeWidth='1'
          />
        ))}
        <Line x1='0' y1='180' x2='400' y2='180' stroke={themeOverride?.overlayStroke ?? design.overlayStroke} strokeWidth='1' opacity='0.65' />
        <Line x1='0' y1='544' x2='400' y2='544' stroke={themeOverride?.overlayStroke ?? design.overlayStroke} strokeWidth='1' opacity='0.45' />
      </Svg>
    </View>
  );
}
