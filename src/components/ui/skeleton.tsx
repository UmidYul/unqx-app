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

interface SkeletonBlockProps {
  tokens: ThemeTokens;
  width?: number | `${number}%`;
  height: number;
  radius?: number;
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
  const isDark = tokens.bg !== '#ffffff';

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      false,
    );
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-160, 160]) }],
  }));

  return (
    <View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        },
        style,
      ]}
    >
      <Animated.View pointerEvents='none' style={[styles.shimmer, shimmerStyle]}>
        <LinearGradient
          colors={isDark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.02)'] : ['#f0f0f0', '#ffffff', '#f0f0f0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
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

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
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
});
