import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { SkeletonBlock } from '@/components/ui/skeleton';
import { APP_DISPLAY_NAME, getBrandLogoSource } from '@/lib/brandAssets';
import { useThemeContext } from '@/theme/ThemeProvider';
import { ThemeTokens } from '@/types';

interface BootLoaderProps {
  tokens: ThemeTokens;
}

export function BootLoader({ tokens }: BootLoaderProps): React.JSX.Element {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.9, 1.2]);
    const opacity = interpolate(pulse.value, [0, 1], [0.32, 0.08]);

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const logoStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [1, 1.04]);
    return {
      transform: [{ scale }],
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      <View style={styles.centerWrap}>
        <Animated.View style={[styles.ring, { backgroundColor: `${tokens.accent}20` }, ringStyle]} />
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image source={getBrandLogoSource(isDark)} style={styles.logo} resizeMode='contain' />
        </Animated.View>
      </View>

      <Text style={[styles.title, { color: tokens.text }]}>{APP_DISPLAY_NAME}</Text>
      <View style={styles.skeletonRow}>
        <SkeletonBlock tokens={tokens} width={124} height={8} radius={6} />
        <SkeletonBlock tokens={tokens} width={86} height={8} radius={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  centerWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
  },
  logoWrap: {
    width: 78,
    height: 78,
    borderRadius: 22,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  skeletonRow: {
    marginTop: 8,
    alignItems: 'center',
    gap: 6,
  },
});
