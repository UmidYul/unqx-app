import React, { PropsWithChildren, useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemeTokens } from '@/types';
import { UnqxQRCode } from '@/components/ui/UnqxQRCode';

const UI_FONT = 'Inter_400Regular';

interface PillProps extends PropsWithChildren {
  color: string;
  bg: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Pill({ children, color, bg, style, textStyle }: PillProps): React.JSX.Element {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.pillText, { color }, textStyle]}>{children}</Text>
    </View>
  );
}

interface LabelProps extends PropsWithChildren {
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Label({ children, color = '#999999', style }: LabelProps): React.JSX.Element {
  return <Text style={[styles.label, { color }, style]}>{children}</Text>;
}

export function Divider({ color }: { color: string }): React.JSX.Element {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

interface ChevronProps {
  color: string;
  size?: number;
}

export function Chevron({ color, size = 14 }: ChevronProps): React.JSX.Element {
  return <ChevronRight size={size} color={color} strokeWidth={1.5} />;
}

interface RowProps {
  label: string;
  value: string;
  textColor?: string;
  mutedColor?: string;
  borderColor?: string;
  onPress?: () => void;
  action?: () => void;
  showChevron?: boolean;
  last?: boolean;
}

export function Row({
  label,
  value,
  textColor = '#111111',
  mutedColor = '#777777',
  borderColor = 'rgba(127,127,127,0.22)',
  onPress,
  action,
  showChevron = false,
  last = false,
}: RowProps): React.JSX.Element {
  const pressHandler = onPress ?? action;
  const withArrow = showChevron || Boolean(pressHandler);

  const content = (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: borderColor,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[styles.rowLabel, { color: mutedColor }]}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: textColor }]} numberOfLines={1}>
          {value}
        </Text>
        {withArrow ? <Chevron color={mutedColor} size={12} /> : null}
      </View>
    </View>
  );

  if (!pressHandler) {
    return content;
  }

  return <Pressable onPress={pressHandler}>{content}</Pressable>;
}

interface ScanAreaProps extends PropsWithChildren {
  active: boolean;
  tokens: ThemeTokens;
  onPress?: () => void;
  minHeight?: number;
}

export function ScanArea({ active, tokens, onPress, minHeight = 240, children }: ScanAreaProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.scanArea,
        {
          minHeight,
          backgroundColor: tokens.surface,
          borderColor: active ? tokens.borderStrong : tokens.border,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

function AnimatedRing({
  durationMs,
  size,
  active,
  color,
  baseOpacity,
}: {
  durationMs: number;
  size: number;
  active: boolean;
  color: string;
  baseOpacity: number;
}): React.JSX.Element {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    if (!active) {
      progress.value = withTiming(0, { duration: 220 });
      return;
    }

    progress.value = withRepeat(
      withTiming(1, {
        duration: durationMs,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [active, durationMs, progress]);

  const ringStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 1.1]);
    const opacity = interpolate(progress.value, [0, 1], [baseOpacity, baseOpacity * 0.4]);

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          borderColor: color,
          width: size,
          height: size,
        },
        ringStyle,
      ]}
    />
  );
}

export function NFCRings({ active, tokens }: { active: boolean; tokens: ThemeTokens }): React.JSX.Element {
  const ringColor = `${tokens.borderStrong}BF`;

  return (
    <View style={[styles.ringsShell, { backgroundColor: tokens.surface }]}>
      <View style={styles.ringsRoot}>
        {[132, 102, 74].map((size) => (
          <View
            key={`static-${size}`}
            style={[
              styles.staticRing,
              {
                borderColor: ringColor,
                width: size,
                height: size,
              },
            ]}
          />
        ))}
        <AnimatedRing durationMs={3000} size={132} active={active} color={tokens.accent} baseOpacity={0.18} />
        <AnimatedRing durationMs={2200} size={102} active={active} color={tokens.accent} baseOpacity={0.28} />
        <AnimatedRing durationMs={1500} size={74} active={active} color={tokens.accent} baseOpacity={0.4} />
        <View
          style={[
            styles.ringsCenter,
            {
              backgroundColor: active ? `${tokens.accent}16` : `${tokens.text}12`,
              borderColor: `${tokens.borderStrong}99`,
            },
          ]}
        >
          <Text style={[styles.ringsCenterText, { color: tokens.textSub }]}>NFC</Text>
        </View>
      </View>
    </View>
  );
}

function AnimatedDot({ delayMs, color }: { delayMs: number; color: string }): React.JSX.Element {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, {
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      ),
    );
  }, [delayMs, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 1], [0.18, 1]);
    const scale = interpolate(progress.value, [0, 1], [0.78, 1]);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: color }, animatedStyle]} />;
}

export function DotsLoader({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={styles.dotsRow}>
      <AnimatedDot delayMs={0} color={color} />
      <AnimatedDot delayMs={200} color={color} />
      <AnimatedDot delayMs={400} color={color} />
    </View>
  );
}

export function CheckCircle({ tokens }: { tokens: ThemeTokens }): React.JSX.Element {
  return (
    <Svg width={26} height={26} viewBox='0 0 26 26'>
      <Circle cx={13} cy={13} r={12} fill={tokens.greenBg} stroke={tokens.green} strokeWidth={1.5} />
      <Path d='M7.5 13L11 16.5L18.5 9.5' stroke={tokens.green} strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' />
    </Svg>
  );
}

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color, width = 90, height = 38 }: SparklineProps): React.JSX.Element {
  const points = useMemo(() => {
    if (data.length <= 1) {
      return '';
    }

    const min = Math.min(...data);
    const max = Math.max(...data);

    return data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / (max - min || 1)) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, height, width]);

  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill='none' stroke={color} strokeWidth={1.8} strokeLinecap='round' strokeLinejoin='round' />
    </Svg>
  );
}

interface QRDisplayProps {
  slug: string;
  size?: number;
}

export function QRDisplay({ slug, size = 150 }: QRDisplayProps): React.JSX.Element {
  return <UnqxQRCode slug={slug} size={size} />;
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
    fontFamily: UI_FONT,
  },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '500',
    fontFamily: UI_FONT,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  row: {
    minHeight: 44,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: UI_FONT,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  rowValue: {
    fontSize: 13,
    fontFamily: UI_FONT,
    textAlign: 'right',
  },
  scanArea: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 24,
  },
  ringsShell: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringsRoot: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  staticRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  ringsCenter: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  ringsCenterText: {
    fontSize: 14,
    letterSpacing: 1.2,
    fontFamily: 'Inter_600SemiBold',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  qrShell: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    alignSelf: 'center',
  },
});
