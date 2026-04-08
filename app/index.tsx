import React from 'react';
import { Redirect } from 'expo-router';

import { BootLoader } from '@/components/startup/BootLoader';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useOnboarding } from '@/hooks/useOnboarding';
import { apiClient } from '@/lib/apiClient';
import { fetchHomeSummaryLike, fetchNotificationsLike, fetchProfileLike } from '@/services/mobileApi';
import { LanguagePickerScreen } from '@/screens/LanguagePickerScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { useThemeContext } from '@/theme/ThemeProvider';

type StartupPhase = 'boot' | 'language' | 'onboarding' | 'route';

async function preloadAppData(signedIn: boolean): Promise<void> {
  if (signedIn) {
    await Promise.allSettled([fetchProfileLike(), fetchHomeSummaryLike(), fetchNotificationsLike()]);
    return;
  }

  await apiClient.get('/public/live-stats').catch(() => undefined);
}

export default function RootIndex(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const onboarding = useOnboarding();
  const { ready, signedIn } = useAuthStatus();
  const [phase, setPhase] = React.useState<StartupPhase>('boot');
  const [onboardingStep, setOnboardingStep] = React.useState(0);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (!ready || startedRef.current) {
      return;
    }

    startedRef.current = true;

    const run = async (): Promise<void> => {
      await Promise.all([
        preloadAppData(signedIn),
        new Promise<void>((resolve) => setTimeout(resolve, 1300)),
      ]);

      const languageDone = await onboarding.isLanguageSelected();
      if (!languageDone) {
        setPhase('language');
        return;
      }

      const onboardingDone = await onboarding.isCompleted();
      if (!onboardingDone) {
        const step = await onboarding.getStep();
        setOnboardingStep(step);
        setPhase('onboarding');
        return;
      }

      setPhase('route');
    };

    void run();
  }, [onboarding, ready, signedIn]);

  const finishLanguage = React.useCallback(() => {
    void (async () => {
      await onboarding.completeLanguageSelection();
      const onboardingDone = await onboarding.isCompleted();
      if (!onboardingDone) {
        const step = await onboarding.getStep();
        setOnboardingStep(step);
        setPhase('onboarding');
      } else {
        setPhase('route');
      }
    })();
  }, [onboarding]);

  const finishOnboarding = React.useCallback(() => {
    void (async () => {
      await onboarding.complete();
      setPhase('route');
    })();
  }, [onboarding]);

  const handleOnboardingStepChange = React.useCallback((step: number) => {
    setOnboardingStep(step);
    void onboarding.setStep(step);
  }, [onboarding]);

  if (!ready || phase === 'boot') {
    return <BootLoader tokens={tokens} />;
  }

  if (phase === 'language') {
    return <LanguagePickerScreen tokens={tokens} onComplete={finishLanguage} />;
  }

  if (phase === 'onboarding') {
    return (
      <OnboardingScreen
        tokens={tokens}
        initialStep={onboardingStep}
        onStepChange={handleOnboardingStepChange}
        onComplete={finishOnboarding}
      />
    );
  }

  if (!signedIn) {
    return <Redirect href='/login' />;
  }

  return <Redirect href='/(tabs)/home' />;
}
