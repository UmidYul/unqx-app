import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  successCount: 'review_success_count',
  lastAsked: 'review_last_asked',
  neverAsk: 'review_never_ask',
} as const;

export function useStoreReview(): {
  maybeAskReview: () => Promise<void>;
  incrementSuccess: () => Promise<void>;
} {
  const maybeAskReview = async () => {
    const neverAsk = await AsyncStorage.getItem(KEYS.neverAsk);
    if (neverAsk) {
      return;
    }

    const lastAsked = await AsyncStorage.getItem(KEYS.lastAsked);
    if (lastAsked) {
      const daysSince = (Date.now() - Number(lastAsked)) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        return;
      }
    }

    const count = Number((await AsyncStorage.getItem(KEYS.successCount)) ?? 0);
    if (count < 3) {
      return;
    }

    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      return;
    }

    await StoreReview.requestReview();
    await AsyncStorage.setItem(KEYS.lastAsked, String(Date.now()));
  };

  const incrementSuccess = async () => {
    const count = Number((await AsyncStorage.getItem(KEYS.successCount)) ?? 0);
    await AsyncStorage.setItem(KEYS.successCount, String(count + 1));
  };

  return { maybeAskReview, incrementSuccess };
}
