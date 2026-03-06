import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, BarChart3, Crown, Radio, ShieldCheck } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  Layout,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemeTokens } from '@/types';

interface OnboardingPagerProps {
  tokens: ThemeTokens;
  onComplete: () => void;
}

const SLIDES = [
  {
    title: 'Цифровая визитка в один тап',
    text: 'Сканируй NFC или делись ссылкой. Контакт открывается мгновенно и выглядит premium.',
    icon: Crown,
    badge: 'Premium Card',
  },
  {
    title: 'Умная NFC-работа',
    text: 'Чтение, запись, проверка и защита меток. Всё в одном красивом экране.',
    icon: Radio,
    badge: 'NFC Engine',
  },
  {
    title: 'Люди и Elite',
    text: 'Контакты, резиденты и рейтинг Elite доступны сразу после входа.',
    icon: ShieldCheck,
    badge: 'Elite Access',
  },
  {
    title: 'Аналитика по тапам',
    text: 'Следи за динамикой тапов, источниками и географией в live-режиме.',
    icon: BarChart3,
    badge: 'Live Analytics',
  },
];

export function OnboardingPager({ tokens, onComplete }: OnboardingPagerProps): React.JSX.Element {
  const [index, setIndex] = React.useState(0);
  const arrowPulse = useSharedValue(0);

  React.useEffect(() => {
    arrowPulse.value = withRepeat(
      withTiming(1, { duration: 920, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [arrowPulse]);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(arrowPulse.value, [0, 1], [1, 1.08]) }],
  }));

  const handleNext = (): void => {
    if (index >= SLIDES.length - 1) {
      onComplete();
      return;
    }
    setIndex((prev) => prev + 1);
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      <Animated.View
        key={index}
        entering={FadeInDown.duration(260)}
        exiting={FadeOutUp.duration(180)}
        layout={Layout.duration(200)}
        style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
      >
        <View style={styles.iconBadgeRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${tokens.accent}14`, borderColor: `${tokens.accent}38` }]}>
            <Icon size={22} color={tokens.accent} strokeWidth={1.8} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${tokens.accent}15`, borderColor: `${tokens.accent}40` }]}>
            <Text style={[styles.badgeText, { color: tokens.accent }]}>{slide.badge}</Text>
          </View>
        </View>

        <Text style={[styles.cardTitle, { color: tokens.text }]}>{slide.title}</Text>
        <Text style={[styles.cardText, { color: tokens.textSub }]}>{slide.text}</Text>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, dotIndex) => (
            <View
              key={`dot-${dotIndex}`}
              style={[
                styles.dot,
                {
                  backgroundColor: dotIndex === index ? tokens.accent : `${tokens.text}2A`,
                  width: dotIndex === index ? 20 : 7,
                },
              ]}
            />
          ))}
        </View>

        <Animated.View style={arrowStyle}>
          <Pressable onPress={handleNext} style={[styles.arrowBtn, { backgroundColor: tokens.accent }]}>
            <ArrowRight size={20} color={tokens.accentText} strokeWidth={1.8} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
    minHeight: 200,
    justifyContent: 'center',
  },
  iconBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'Inter_600SemiBold',
  },
  cardText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 7,
    borderRadius: 999,
  },
  arrowBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
