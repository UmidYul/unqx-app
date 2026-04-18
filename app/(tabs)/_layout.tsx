import React from 'react';
import { Stack } from 'expo-router';
import { useThemeContext } from '@/theme/ThemeProvider';

export default function TabsLayout(): React.JSX.Element {
  const { tokens } = useThemeContext();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 240,
        gestureEnabled: true,
        contentStyle: {
          backgroundColor: tokens.phoneBg,
        },
      }}
    />
  );
}
