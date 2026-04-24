import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemeTokens } from '@/types';
import { isDarkThemeTokens } from '@/theme/tokens';

interface SkeletonBlockProps {
  tokens: ThemeTokens;
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

interface SkeletonCardProps {
  tokens: ThemeTokens;
  children: React.ReactNode;
  radius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBlock({
  tokens,
  width = '100%',
  height,
  radius = 10,
  style,
}: SkeletonBlockProps): React.JSX.Element {
  const progress = useSharedValue(0);
  const isDark = isDarkThemeTokens(tokens);
  const baseColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.08)';
  const shimmerColors: readonly [string, string, string] = isDark
    ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']
    : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.58)', 'rgba(255,255,255,0)'];

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1280,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      false,
    );
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-140, 240]) }],
  }));

  return (
    <View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: baseColor,
        },
        style,
      ]}
    >
      <View pointerEvents='none' style={[styles.clip, { borderRadius: radius }]}>
        <Animated.View pointerEvents='none' style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={shimmerColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export function SkeletonCircle({
  tokens,
  size,
  style,
}: {
  tokens: ThemeTokens;
  size: number;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <SkeletonBlock tokens={tokens} width={size} height={size} radius={size / 2} style={style} />;
}

export function SkeletonCard({
  tokens,
  children,
  radius = 18,
  padding = 18,
  style,
}: SkeletonCardProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius,
          padding,
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
  },
  shimmerGradient: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
