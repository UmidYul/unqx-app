import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeTokens } from '@/types';

interface OfflineBannerProps {
  isOnline: boolean;
  tokens: ThemeTokens;
}

export function OfflineBanner({ isOnline, tokens }: OfflineBannerProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const progress = React.useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!isOnline) {
      setVisible(true);
    }

    Animated.timing(progress, {
      toValue: isOnline ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && isOnline) {
        setVisible(false);
      }
    });
  }, [isOnline, progress]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents='none'
      style={[
        styles.container,
        {
          top: insets.top + 8,
          borderColor: `${tokens.amber}55`,
          backgroundColor: tokens.amberBg,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <WifiOff size={15} strokeWidth={1.8} color={tokens.amber} />
      <Text style={[styles.text, { color: tokens.text }]}>Нет соединения — показаны сохранённые данные</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 30,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_500Medium',
  },
});
