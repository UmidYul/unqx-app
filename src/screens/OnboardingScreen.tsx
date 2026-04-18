import React from 'react';
import {
  FlatList,
  Image,
  Linking,
  ListRenderItemInfo,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BarChart2, Bell, CheckCircle2, LayoutGrid, PenLine, ScanLine, Wifi } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useNFC } from '@/hooks/useNFC';
import { requestPushPermission } from '@/hooks/usePushNotifications';
import { getBrandLogoSource } from '@/lib/brandAssets';
import { apiClient } from '@/lib/apiClient';
import { useThemeContext } from '@/theme/ThemeProvider';
import { ThemeTokens } from '@/types';
import { toast } from '@/utils/toast';
import { MESSAGES } from '@/constants/messages';

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

function buildSteps(): StepItem[] {
  const m = MESSAGES.ui.onboarding;
  return [
    { key: 'welcome', title: m.welcomeTitle, text: m.welcomeText, Icon: Wifi },
    { key: 'how', title: m.howTitle, text: m.howText, Icon: ScanLine },
    { key: 'nfc', title: m.nfcTitle, text: m.nfcText, Icon: Wifi },
    { key: 'push', title: m.pushTitle, text: m.pushText, Icon: Bell },
    { key: 'done', title: m.doneTitle, text: m.doneText, Icon: CheckCircle2 },
  ];
}

function clampStep(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(4, Math.floor(value)));
}

function isGrantedPermission(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if ('granted' in value && typeof value.granted === 'boolean') {
    return value.granted;
  }
  if ('status' in value && typeof value.status === 'string') {
    return value.status === 'granted';
  }
  return false;
}

export function OnboardingScreen({
  tokens,
  initialStep,
  onStepChange,
  onComplete,
}: OnboardingScreenProps): React.JSX.Element {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isSupported: nfcSupported, requestPermission: requestNfcPermission } = useNFC();
  const STEPS = React.useMemo(() => buildSteps(), []);
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
      try {
        if (!nfcSupported) {
          toast.info(MESSAGES.ui.onboarding.nfcUnavailable);
          nextStep();
          return;
        }

        const enabled = await requestNfcPermission();
        if (!enabled) {
          toast.info(MESSAGES.ui.onboarding.nfcEnableSettings);
          return;
        }

        nextStep();
      } catch {
        toast.error(MESSAGES.ui.onboarding.nfcRequestFailed);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (step === 3) {
      setBusy(true);
      try {
        const Notifications = await import('expo-notifications');
        const current = await Notifications.getPermissionsAsync();
        let granted = isGrantedPermission(current);

        if (!granted) {
          const requested = await Notifications.requestPermissionsAsync();
          granted = isGrantedPermission(requested);
        }

        if (!granted) {
          toast.info(MESSAGES.ui.onboarding.pushEnableSettings);
          await Linking.openSettings().catch(() => undefined);
          return;
        }

        const token = await requestPushPermission();
        if (token) {
          await apiClient.post('/notifications/token', {
            token,
            expoToken: token,
            platform: Platform.OS,
          }).catch(() => undefined);
        }

        nextStep();
      } catch {
        toast.error(MESSAGES.ui.onboarding.pushRequestFailed);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (step === 4) {
      onComplete();
      return;
    }

    nextStep();
  }, [busy, nfcSupported, nextStep, onComplete, requestNfcPermission, step]);

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
    const m = MESSAGES.ui.onboarding;
    if (step === 0) return m.start;
    if (step === 2) return m.allowNfc;
    if (step === 3) return m.enablePush;
    if (step === 4) return m.openApp;
    return m.next;
  }, [step]);

  const showSecondaryLater = step === 2 || step === 3;
  const showBack = step >= 1 && step <= 3;
  const footerBottomInset = Math.max(24, insets.bottom + 12);
  const footerReservedHeight = showSecondaryLater ? 132 : 92;
  const slideBottomInset = footerBottomInset + footerReservedHeight;

  const renderItem = React.useCallback(
    ({ item }: ListRenderItemInfo<StepItem>) => (
      <View style={[styles.slide, { width, paddingBottom: slideBottomInset }]}>
        <View style={[styles.iconWrap, { backgroundColor: `${tokens.accent}15`, borderColor: `${tokens.accent}45` }]}>
          {item.key === 'welcome' ? (
            <Image source={getBrandLogoSource(isDark)} style={styles.brandLogo} resizeMode='contain' />
          ) : (
            <item.Icon size={72} color={item.key === 'done' ? tokens.text : tokens.accent} strokeWidth={1.5} />
          )}
        </View>

        <Text style={[styles.title, { color: tokens.text }]}>{item.title}</Text>
        <Text style={[styles.subtitle, { color: tokens.textMuted }]}>{item.text}</Text>

        {item.key === 'how' ? (
          <View style={[styles.howList, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
            <HowRow Icon={ScanLine} tokens={tokens} text={MESSAGES.ui.onboarding.howScan} />
            <HowRow Icon={PenLine} tokens={tokens} text={MESSAGES.ui.onboarding.howWrite} />
            <HowRow Icon={BarChart2} tokens={tokens} text={MESSAGES.ui.onboarding.howAnalytics} />
            <HowRow Icon={LayoutGrid} tokens={tokens} text={MESSAGES.ui.onboarding.howWidget} />
          </View>
        ) : null}
      </View>
    ),
    [isDark, slideBottomInset, tokens, width],
  );

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      {step < 4 ? (
        <AnimatedPressable
          containerStyle={[styles.skipTop, { top: insets.top + 10 }]}
          style={styles.skipTopInner}
          onPress={handleSkip}
          hitSlop={8}
        >
          <Text style={[styles.skipTopText, { color: tokens.textMuted }]}>{MESSAGES.ui.onboarding.skip}</Text>
        </AnimatedPressable>
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
        keyboardShouldPersistTaps='handled'
        scrollEnabled={!busy}
      />

      <View style={[styles.footer, { backgroundColor: tokens.bg, paddingBottom: footerBottomInset }]}>
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
            <AnimatedPressable
              containerStyle={[styles.backBtnWrap, { opacity: busy ? 0.55 : 1 }]}
              style={[styles.backBtn, { borderColor: tokens.border }]}
              onPress={handleBack}
              disabled={busy}
              hitSlop={8}
            >
              <Text style={[styles.backText, { color: tokens.text }]}>{MESSAGES.ui.onboarding.back}</Text>
            </AnimatedPressable>
          ) : <View style={styles.backSpacer} />}
        </View>

        <AnimatedPressable
          containerStyle={styles.primaryBtnWrap}
          style={[
            styles.primaryBtn,
            { backgroundColor: tokens.accent, opacity: busy ? 0.55 : 1 },
          ]}
          onPress={() => void handlePrimary()}
          disabled={busy}
          accessibilityRole='button'
          hitSlop={8}
        >
          <Text style={[styles.primaryText, { color: tokens.accentText }]}>
            {busy ? MESSAGES.ui.onboarding.wait : getPrimaryLabel}
          </Text>
        </AnimatedPressable>

        {showSecondaryLater ? (
          <AnimatedPressable
            containerStyle={styles.laterBtnWrap}
            style={[styles.laterBtn, { opacity: busy ? 0.55 : 1 }]}
            onPress={nextStep}
            disabled={busy}
            hitSlop={8}
          >
            <Text style={[styles.laterText, { color: tokens.textMuted }]}>{MESSAGES.ui.onboarding.later}</Text>
          </AnimatedPressable>
        ) : null}
      </View>
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    elevation: 12,
    paddingTop: 8,
  },
  skipTop: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
  },
  skipTopInner: {
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
  backBtnWrap: {
    minWidth: 72,
  },
  backText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  backSpacer: {
    width: 72,
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnWrap: {
    marginHorizontal: 24,
    marginTop: 12,
  },
  primaryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  laterBtn: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtnWrap: {
    marginTop: 10,
  },
  laterText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
