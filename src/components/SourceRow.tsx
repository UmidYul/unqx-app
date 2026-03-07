import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useLanguageContext } from '@/i18n/LanguageProvider';
import { ThemeTokens, TapSource } from '@/types';
import { getSourceConfig, resolveSource } from '@/utils/sourceConfig';

interface SourceRowProps {
  source: TapSource | string;
  count: number;
  percent: number;
  index: number;
  tokens: ThemeTokens;
}

export function SourceRow({ source, count, percent, index, tokens }: SourceRowProps): React.JSX.Element {
  const { language } = useLanguageContext();
  const resolved = resolveSource(source);
  const sourceConfig = React.useMemo(() => getSourceConfig(tokens, language), [tokens, language]);
  const config = sourceConfig[resolved];
  const isDark = tokens.text === '#f5f5f5';
  const trackColor = isDark ? 'rgba(255,255,255,0.14)' : `${tokens.border}22`;
  const fillColor = isDark ? 'rgba(232,223,200,0.9)' : config.color;
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      index * 150,
      withTiming(Math.max(0, Math.min(100, percent)), {
        duration: 800,
        easing: Easing.out(Easing.ease),
      }),
    );
  }, [index, percent, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.labelWrap}>
          <config.Icon size={13} strokeWidth={1.5} color={config.color} />
          <Text style={[styles.label, { color: tokens.text }]}>{config.label}</Text>
        </View>
        <Text style={[styles.meta, { color: isDark ? 'rgba(255,255,255,0.62)' : tokens.textMuted }]}>{`${count} · ${percent}%`}</Text>
      </View>
      <View style={[styles.track, { borderColor: tokens.border, backgroundColor: trackColor }]}>
        <Animated.View style={[styles.fill, { backgroundColor: fillColor }, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  meta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  track: {
    height: 5,
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 0,
  },
});
