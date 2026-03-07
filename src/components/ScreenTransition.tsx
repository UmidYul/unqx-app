import React from 'react';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

export function ScreenTransition({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Animated.View
      entering={FadeIn.duration(220).easing(Easing.out(Easing.cubic))}
      style={{ flex: 1 }}
    >
      {children}
    </Animated.View>
  );
}
