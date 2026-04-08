import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_SELECTED_KEY = 'language_selected';
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
const ONBOARDING_STEP_KEY = 'onboarding_step';

function clampStep(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(4, Math.floor(value)));
}

export function useOnboarding(): {
  isLanguageSelected: () => Promise<boolean>;
  completeLanguageSelection: () => Promise<void>;
  isCompleted: () => Promise<boolean>;
  complete: () => Promise<void>;
  getStep: () => Promise<number>;
  setStep: (step: number) => Promise<void>;
} {
  const isLanguageSelected = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(LANGUAGE_SELECTED_KEY);
      return raw === '1';
    } catch {
      return false;
    }
  }, []);

  const completeLanguageSelection = useCallback(async () => {
    try {
      await AsyncStorage.setItem(LANGUAGE_SELECTED_KEY, '1');
    } catch {
      // noop
    }
  }, []);

  const isCompleted = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      return raw === '1' || raw === 'true';
    } catch {
      return false;
    }
  }, []);

  const complete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
      await AsyncStorage.removeItem(ONBOARDING_STEP_KEY);
    } catch {
      // noop
    }
  }, []);

  const getStep = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_STEP_KEY);
      if (!raw) return 0;
      const parsed = Number(raw);
      return clampStep(parsed);
    } catch {
      return 0;
    }
  }, []);

  const setStep = useCallback(async (step: number) => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STEP_KEY, String(clampStep(step)));
    } catch {
      // noop
    }
  }, []);

  return {
    isLanguageSelected,
    completeLanguageSelection,
    isCompleted,
    complete,
    getStep,
    setStep,
  };
}
