import React from 'react';
import {
  FlatList,
  Image,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BarChart2, Bell, CheckCircle2, LayoutGrid, PenLine, ScanLine, Wifi } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNFC } from '@/hooks/useNFC';
import { requestPushPermission } from '@/hooks/usePushNotifications';
import { apiClient } from '@/lib/apiClient';
import { ThemeTokens } from '@/types';

interface OnboardingScreenProps {
  tokens: ThemeTokens;
  initialStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}

interface StepItem {
  key: string;
  title: string;
  text: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const STEPS: StepItem[] = [
  {
    key: 'welcome',
    title: 'UNQX NFC Manager',
    text: 'Управляй своей цифровой визиткой. Читай и записывай NFC-метки.',
    Icon: Wifi,
  },
  {
    key: 'how',
    title: 'Как это работает',
    text: 'Сканируй, записывай и анализируй тапы в одном приложении.',
    Icon: ScanLine,
  },
  {
    key: 'nfc',
    title: 'Разрешить NFC',
    text: 'Приложению нужен доступ к NFC чтобы читать и записывать метки. Данные не покидают устройство.',
    Icon: Wifi,
  },
  {
    key: 'push',
    title: 'Будь в курсе',
    text: 'Получай уведомления когда кто-то открывает твою визитку или меняется статус заказа.',
    Icon: Bell,
  },
  {
    key: 'done',
    title: 'Всё готово',
    text: 'Твой UNQ настроен. Начни делиться визиткой прямо сейчас.',
    Icon: CheckCircle2,
  },
];

function clampStep(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(STEPS.length - 1, Math.floor(value)));
}

export function OnboardingScreen({
  tokens,
  initialStep,
  onStepChange,
  onComplete,
}: OnboardingScreenProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { requestPermission: requestNfcPermission } = useNFC();
  const listRef = React.useRef<FlatList<StepItem> | null>(null);
  const [step, setStep] = React.useState(clampStep(initialStep));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const index = clampStep(initialStep);
    setStep(index);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: false });
    });
  }, [initialStep]);

  React.useEffect(() => {
    onStepChange(step);
  }, [onStepChange, step]);

  const goToStep = React.useCallback(
    (next: number) => {
      const clamped = clampStep(next);
      setStep(clamped);
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    },
    [],
  );

  const nextStep = React.useCallback(() => {
    if (step >= STEPS.length - 1) {
      onComplete();
      return;
    }
    goToStep(step + 1);
  }, [goToStep, onComplete, step]);

  const handlePrimary = React.useCallback(async () => {
    if (busy) return;

    if (step === 2) {
      setBusy(true);
      await requestNfcPermission();
      setBusy(false);
      nextStep();
      return;
    }

    if (step === 3) {
      setBusy(true);
      const token = await requestPushPermission();
      if (token) {
        await apiClient.post('/notifications/token', { token }).catch(() => undefined);
      }
      setBusy(false);
      nextStep();
      return;
    }

    if (step === 4) {
      onComplete();
      return;
    }

    nextStep();
  }, [busy, nextStep, onComplete, requestNfcPermission, step]);

  const handleSkip = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onComplete();
  }, [onComplete]);

  const handleBack = React.useCallback(() => {
    if (step > 0) {
      goToStep(step - 1);
    }
  }, [goToStep, step]);

  const onMomentumEnd = React.useCallback(
    (event: any) => {
      const offset = Number(event?.nativeEvent?.contentOffset?.x ?? 0);
      const index = clampStep(Math.round(offset / Math.max(1, width)));
      if (index !== step) {
        setStep(index);
      }
    },
    [step, width],
  );

  const getPrimaryLabel = React.useMemo(() => {
    if (step === 0) return 'Начать';
    if (step === 2) return 'Разрешить NFC';
    if (step === 3) return 'Включить уведомления';
    if (step === 4) return 'Открыть приложение';
    return 'Далее';
  }, [step]);

  const showSecondaryLater = step === 2 || step === 3;
  const showBack = step >= 1 && step <= 3;

  const renderItem = React.useCallback(
    ({ item }: ListRenderItemInfo<StepItem>) => (
      <View style={[styles.slide, { width }]}>
        <View style={[styles.iconWrap, { backgroundColor: `${tokens.accent}15`, borderColor: `${tokens.accent}45` }]}>
          {item.key === 'welcome' ? (
            <Image source={require('../../assets/brand/logo.png')} style={styles.brandLogo} resizeMode='contain' />
          ) : (
            <item.Icon size={72} color={item.key === 'done' ? tokens.green : tokens.accent} strokeWidth={1.5} />
          )}
        </View>

        <Text style={[styles.title, { color: tokens.text }]}>{item.title}</Text>
        <Text style={[styles.subtitle, { color: tokens.textMuted }]}>{item.text}</Text>

        {item.key === 'how' ? (
          <View style={[styles.howList, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
            <HowRow Icon={ScanLine} tokens={tokens} text='Сканируй чужие визитки одним касанием' />
            <HowRow Icon={PenLine} tokens={tokens} text='Записывай свой UNQ на браслет или наклейку' />
            <HowRow Icon={BarChart2} tokens={tokens} text='Смотри кто и когда тапнул твою карточку' />
            <HowRow Icon={LayoutGrid} tokens={tokens} text='Добавляй UNQX-виджет на домашний экран для быстрого доступа' />
          </View>
        ) : null}
      </View>
    ),
    [tokens, width],
  );

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingBottom: Math.max(24, insets.bottom + 12) }]}>
      {step < 4 ? (
        <Pressable style={[styles.skipTop, { top: insets.top + 10 }]} onPress={handleSkip}>
          <Text style={[styles.skipTopText, { color: tokens.textMuted }]}>Пропустить</Text>
        </Pressable>
      ) : null}

      <FlatList
        ref={listRef}
        style={styles.slidesList}
        data={STEPS}
        horizontal
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        initialNumToRender={STEPS.length}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      <View style={styles.bottomBar}>
        <View style={styles.dots}>
          {STEPS.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.dot,
                {
                  width: index === step ? 18 : 7,
                  backgroundColor: index === step ? tokens.accent : `${tokens.textMuted}55`,
                },
              ]}
            />
          ))}
        </View>

        {showBack ? (
          <Pressable style={[styles.backBtn, { borderColor: tokens.border }]} onPress={handleBack} disabled={busy}>
            <Text style={[styles.backText, { color: tokens.text }]}>Назад</Text>
          </Pressable>
        ) : <View style={styles.backSpacer} />}
      </View>

      <Pressable
        style={[
          styles.primaryBtn,
          { backgroundColor: tokens.accent, opacity: busy ? 0.55 : 1 },
        ]}
        onPress={() => void handlePrimary()}
        disabled={busy}
      >
        <Text style={[styles.primaryText, { color: tokens.accentText }]}>{busy ? 'Подождите...' : getPrimaryLabel}</Text>
      </Pressable>

      {showSecondaryLater ? (
        <Pressable style={styles.laterBtn} onPress={nextStep} disabled={busy}>
          <Text style={[styles.laterText, { color: tokens.textMuted }]}>Позже</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HowRow({
  Icon,
  text,
  tokens,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  text: string;
  tokens: ThemeTokens;
}): React.JSX.Element {
  return (
    <View style={styles.howRow}>
      <View style={[styles.howIcon, { backgroundColor: `${tokens.accent}14` }]}>
        <Icon size={17} color={tokens.accent} strokeWidth={1.5} />
      </View>
      <Text style={[styles.howText, { color: tokens.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slidesList: {
    flex: 1,
  },
  skipTop: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
    padding: 8,
  },
  skipTopText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  iconWrap: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 92,
    height: 92,
    borderRadius: 20,
  },
  title: {
    marginTop: 24,
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    maxWidth: 330,
  },
  howList: {
    marginTop: 22,
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  howIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
  },
  bottomBar: {
    marginTop: 6,
    paddingHorizontal: 24,
    minHeight: 32,
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
  backBtn: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  backSpacer: {
    width: 72,
  },
  primaryBtn: {
    marginHorizontal: 24,
    marginTop: 12,
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  laterBtn: {
    marginTop: 10,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
