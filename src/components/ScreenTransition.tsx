import React from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

export function ScreenTransition({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Animated.View entering={FadeInDown.duration(220).springify().damping(18).stiffness(180)} style={{ flex: 1 }}>
      {children}
    </Animated.View>
  );
}
