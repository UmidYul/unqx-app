import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

import { nfcApi } from '@/lib/apiClient';
import { addSentryBreadcrumb } from '@/lib/sentry';
import { NFCTag, NFCState } from '@/types';

export interface UseNfcResult {
  isSupported: boolean;
  state: NFCState;
  tag: NFCTag | null;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  startRead: () => Promise<void>;
  writeURL: (url: string) => Promise<void>;
  verify: () => Promise<void>;
  lock: (password: string) => Promise<void>;
  reset: () => void;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'NFC operation failed';
}

export const NFC_UNSUPPORTED_ERROR = 'NFC недоступен на этом устройстве';
export const NFC_PROTECTED_TAG_ERROR = 'NFC_TAG_PROTECTED';

function parseTag(rawTag: any): NFCTag {
  const records = rawTag?.ndefMessage ?? [];
  let url: string | undefined;

  for (const record of records) {
    if (record?.tnf === Ndef.TNF_WELL_KNOWN && Array.isArray(record?.payload)) {
      const decoded = Ndef.uri.decodePayload(record.payload);
      if (decoded) {
        url = decoded;
        break;
      }
    }
  }

  return {
    uid: rawTag?.id,
    type: rawTag?.type,
    capacity: rawTag?.maxSize,
    used: rawTag?.ndefMessage?.length,
    url,
    isLocked: rawTag?.isWritable === false,
  };
}

async function withNdefTag<T>(callback: (rawTag: any) => Promise<T>): Promise<T> {
  await NfcManager.requestTechnology(NfcTech.Ndef);
  const rawTag = await NfcManager.getTag();
  const result = await callback(rawTag);
  return result;
}

export function useNFC(): UseNfcResult {
  const [isSupported, setIsSupported] = useState(false);
  const [state, setState] = useState<NFCState>('idle');
  const [tag, setTag] = useState<NFCTag | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init(): Promise<void> {
      try {
        const supported = await NfcManager.isSupported();

        if (supported) {
          await NfcManager.start();
        }

        if (mounted) {
          setIsSupported(Boolean(supported));
        }
      } catch {
        if (mounted) {
          setIsSupported(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      void NfcManager.cancelTechnologyRequest().catch(() => undefined);
    };
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setTag(null);
    setError(null);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        return false;
      }
      await NfcManager.start();

      if (typeof NfcManager.isEnabled === 'function') {
        const enabled = await NfcManager.isEnabled();
        if (enabled) {
          return true;
        }

        if (Platform.OS === 'android' && typeof NfcManager.goToNfcSetting === 'function') {
          await NfcManager.goToNfcSetting();
        }
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  const startRead = useCallback(async () => {
    addSentryBreadcrumb({
      category: 'nfc',
      message: 'NFC scan started',
    });
    if (!isSupported) {
      setState('idle');
      setError(NFC_UNSUPPORTED_ERROR);
      return;
    }

    setState('scanning');
    setError(null);

    try {
      await withNdefTag(async (rawTag) => {
        const parsed = parseTag(rawTag);
        setTag(parsed);
        setState('success');
        await nfcApi.scan({ uid: parsed.uid, url: parsed.url }).catch(() => undefined);
      });
    } catch (e) {
      setError(toErrorMessage(e));
      setState('idle');
    } finally {
      void NfcManager.cancelTechnologyRequest().catch(() => undefined);
    }
  }, [isSupported]);

  const writeURL = useCallback(
    async (url: string) => {
      addSentryBreadcrumb({
        category: 'nfc',
        message: 'NFC write started',
      });
      if (!isSupported) {
        setState('idle');
        setError(NFC_UNSUPPORTED_ERROR);
        return;
      }

      setState('writing');
      setError(null);

      try {
        await withNdefTag(async (rawTag) => {
          const parsed = parseTag(rawTag);
          if (parsed.isLocked) {
            setTag(parsed);
            throw new Error(NFC_PROTECTED_TAG_ERROR);
          }

          const message = Ndef.encodeMessage([Ndef.uriRecord(url)]);

          if (!message) {
            throw new Error('Failed to encode NFC message');
          }

          await NfcManager.ndefHandler.writeNdefMessage(message);

          setTag({ ...parsed, url });
          setState('written');
          await nfcApi.write({ url, uid: parsed.uid }).catch(() => undefined);
        });
      } catch (e) {
        setError(toErrorMessage(e));
        setState('idle');
      } finally {
        void NfcManager.cancelTechnologyRequest().catch(() => undefined);
      }
    },
    [isSupported],
  );

  const verify = useCallback(async () => {
    addSentryBreadcrumb({
      category: 'nfc',
      message: 'NFC verify started',
    });
    if (!isSupported) {
      setState('idle');
      setError(NFC_UNSUPPORTED_ERROR);
      return;
    }

    setState('verifying');
    setError(null);

    try {
      await withNdefTag(async (rawTag) => {
        const parsed = parseTag(rawTag);
        setTag(parsed);
        setState('verified');
        await nfcApi.markVerified({ uid: parsed.uid, url: parsed.url }).catch(() => undefined);
      });
    } catch (e) {
      setError(toErrorMessage(e));
      setState('idle');
    } finally {
      void NfcManager.cancelTechnologyRequest().catch(() => undefined);
    }
  }, [isSupported]);

  const lock = useCallback(
    async (password: string) => {
      addSentryBreadcrumb({
        category: 'nfc',
        message: 'NFC lock started',
      });
      if (!isSupported) {
        setState('idle');
        setError(NFC_UNSUPPORTED_ERROR);
        return;
      }

      setState('locking');
      setError(null);

      try {
        await withNdefTag(async (rawTag) => {
          const parsed = parseTag(rawTag);

          // Universal tag lock is not available across all chip types, so we keep API-side lock policy.
          await nfcApi.lock({ password, uid: parsed.uid });

          setTag({ ...parsed, isLocked: true });
          setState('locked');
        });
      } catch (e) {
        setError(toErrorMessage(e));
        setState('idle');
      } finally {
        void NfcManager.cancelTechnologyRequest().catch(() => undefined);
      }
    },
    [isSupported],
  );

  return {
    isSupported,
    state,
    tag,
    error,
    requestPermission,
    startRead,
    writeURL,
    verify,
    lock,
    reset,
  };
}
