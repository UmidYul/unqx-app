import { useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRICS_ENABLED_KEY = 'biometrics_enabled';
const BIOMETRICS_ASKED_KEY = 'biometrics_asked';
const BIOMETRIC_LOCK_TIMEOUT_MS_KEY = 'biometric_lock_timeout_ms';

export const DEFAULT_BIOMETRIC_LOCK_TIMEOUT_MS = 2000;

export type BiometricType = 'Face ID' | 'Touch ID' | 'Fingerprint' | null;

async function readBoolean(key: string, fallback = false): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1' || raw === 'true';
  } catch {
    return fallback;
  }
}

async function writeBoolean(key: string, value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value ? '1' : '0');
  } catch {
    // noop
  }
}

function mapBiometricType(types: LocalAuthentication.AuthenticationType[]): BiometricType {
  if (!Array.isArray(types) || types.length === 0) {
    return null;
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  }

  return null;
}

export function useBiometrics(): {
  isAvailable: () => Promise<boolean>;
  isEnrolled: () => Promise<boolean>;
  authenticate: (reason: string) => Promise<boolean>;
  getBiometricType: () => Promise<BiometricType>;
  getBiometricsEnabled: () => Promise<boolean>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  getBiometricsAsked: () => Promise<boolean>;
  setBiometricsAsked: (asked: boolean) => Promise<void>;
  getBiometricLockTimeoutMs: () => Promise<number>;
  setBiometricLockTimeoutMs: (timeoutMs: number) => Promise<void>;
} {
  const isAvailable = useCallback(async () => {
    try {
      return await LocalAuthentication.hasHardwareAsync();
    } catch {
      return false;
    }
  }, []);

  const isEnrolled = useCallback(async () => {
    try {
      return await LocalAuthentication.isEnrolledAsync();
    } catch {
      return false;
    }
  }, []);

  const authenticate = useCallback(async (reason: string) => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Использовать пароль',
        cancelLabel: 'Отмена',
        disableDeviceFallback: false,
      });
      return Boolean(result.success);
    } catch {
      return false;
    }
  }, []);

  const getBiometricType = useCallback(async (): Promise<BiometricType> => {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return mapBiometricType(types);
    } catch {
      return null;
    }
  }, []);

  const getBiometricsEnabled = useCallback(async () => readBoolean(BIOMETRICS_ENABLED_KEY, false), []);
  const setBiometricsEnabled = useCallback(async (enabled: boolean) => writeBoolean(BIOMETRICS_ENABLED_KEY, enabled), []);
  const getBiometricsAsked = useCallback(async () => readBoolean(BIOMETRICS_ASKED_KEY, false), []);
  const setBiometricsAsked = useCallback(async (asked: boolean) => writeBoolean(BIOMETRICS_ASKED_KEY, asked), []);

  const getBiometricLockTimeoutMs = useCallback(async (): Promise<number> => {
    try {
      const raw = await AsyncStorage.getItem(BIOMETRIC_LOCK_TIMEOUT_MS_KEY);
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return DEFAULT_BIOMETRIC_LOCK_TIMEOUT_MS;
      }
      return Math.round(parsed);
    } catch {
      return DEFAULT_BIOMETRIC_LOCK_TIMEOUT_MS;
    }
  }, []);

  const setBiometricLockTimeoutMs = useCallback(async (timeoutMs: number): Promise<void> => {
    const normalized = Number.isFinite(timeoutMs) && timeoutMs >= 0
      ? Math.round(timeoutMs)
      : DEFAULT_BIOMETRIC_LOCK_TIMEOUT_MS;
    try {
      await AsyncStorage.setItem(BIOMETRIC_LOCK_TIMEOUT_MS_KEY, String(normalized));
    } catch {
      // noop
    }
  }, []);

  return {
    isAvailable,
    isEnrolled,
    authenticate,
    getBiometricType,
    getBiometricsEnabled,
    setBiometricsEnabled,
    getBiometricsAsked,
    setBiometricsAsked,
    getBiometricLockTimeoutMs,
    setBiometricLockTimeoutMs,
  };
}
