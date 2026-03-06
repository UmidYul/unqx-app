import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { anim } from '@/utils/animations';

interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

export function AnimatedPressable({
  children,
  containerStyle,
  style,
  onPressIn,
  onPressOut,
  scaleTo = 0.96,
  ...rest
}: AnimatedPressableProps): React.JSX.Element {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      onPressIn={(event) => {
        scale.value = scaleTo === 0.96 ? anim.press : anim.press;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = anim.release;
        onPressOut?.(event);
      }}
    >
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}
