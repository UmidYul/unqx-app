import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

import { getMessagesLanguage } from '@/constants/messages';
import { nfcApi } from '@/lib/apiClient';
import { appendLocalNfcHistory } from '@/lib/nfcLocalHistory';
import { addSentryBreadcrumb } from '@/lib/sentry';
import { NFCTag, NFCState, NfcWritablePayload } from '@/types';
import { toUserErrorMessage } from '@/utils/errorMessages';
import { extractSlug } from '@/utils/links';
import { getPayloadPreview } from '@/utils/nfcPayloads';

export interface UseNfcResult {
  isSupported: boolean;
  state: NFCState;
  tag: NFCTag | null;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  startRead: () => Promise<void>;
  writePayload: (payload: NfcWritablePayload) => Promise<void>;
  verify: () => Promise<void>;
  lock: (password: string) => Promise<void>;
  reset: () => void;
}

export const NFC_UNSUPPORTED_ERROR = 'NFC недоступен на этом устройстве';
export const NFC_PROTECTED_TAG_ERROR = 'NFC_TAG_PROTECTED';

function unsupportedNfcMessage(): string {
  return getMessagesLanguage() === 'uz'
    ? 'Bu qurilmada NFC mavjud emas'
    : NFC_UNSUPPORTED_ERROR;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === NFC_PROTECTED_TAG_ERROR) {
    return NFC_PROTECTED_TAG_ERROR;
  }

  const fallback = getMessagesLanguage() === 'uz'
    ? "NFC xatosi. Qayta urinib ko'ring"
    : 'Ошибка NFC. Повторите попытку';
  return toUserErrorMessage(error, fallback);
}

function parseTag(rawTag: any): NFCTag {
  const records = rawTag?.ndefMessage ?? [];
  let payload: Pick<NFCTag, 'url' | 'payloadKind' | 'payloadValue' | 'displayValue' | 'slug'> = {
    payloadKind: records.length > 0 ? 'unknown' : undefined,
  };

  for (const record of records) {
    if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI) && Array.isArray(record?.payload)) {
      const decoded = Ndef.uri.decodePayload(record.payload);
      if (decoded) {
        const slug = extractSlug(decoded) ?? undefined;
        payload = {
          url: decoded,
          payloadKind: 'url',
          payloadValue: decoded,
          displayValue: getPayloadPreview('url', decoded, slug),
          slug,
        };
        break;
      }
    }

    if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT) && Array.isArray(record?.payload)) {
      const decoded = Ndef.text.decodePayload(Uint8Array.from(record.payload));
      if (decoded) {
        payload = {
          payloadKind: 'text',
          payloadValue: decoded,
          displayValue: getPayloadPreview('text', decoded),
        };
        break;
      }
    }
  }

  return {
    uid: rawTag?.id,
    type: rawTag?.type,
    capacity: rawTag?.maxSize,
    used: rawTag?.ndefMessage?.length,
    ...payload,
    isLocked: rawTag?.isWritable === false,
  };
}

function toHistoryEntry(tag: NFCTag, type: 'read' | 'write' | 'verify' | 'lock', templateId?: NfcWritablePayload['templateId']) {
  return {
    type,
    uid: tag.uid,
    slug: tag.slug,
    payloadKind: tag.payloadKind ?? 'unknown',
    payloadValue: tag.payloadValue,
    displayValue: tag.displayValue,
    templateId,
  } as const;
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

    void init();

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
      setError(unsupportedNfcMessage());
      return;
    }

    setState('scanning');
    setError(null);

    try {
      await withNdefTag(async (rawTag) => {
        const parsed = parseTag(rawTag);
        setTag(parsed);
        setState('success');
        await appendLocalNfcHistory(toHistoryEntry(parsed, 'read'));
        await nfcApi.scan({
          uid: parsed.uid,
          url: parsed.url,
          slug: parsed.slug,
          payloadKind: parsed.payloadKind,
          payloadValue: parsed.payloadValue,
          displayValue: parsed.displayValue,
        });
      });
    } catch (e) {
      setError(toErrorMessage(e));
      setState('idle');
    } finally {
      void NfcManager.cancelTechnologyRequest().catch(() => undefined);
    }
  }, [isSupported]);

  const writePayload = useCallback(
    async (payload: NfcWritablePayload) => {
      addSentryBreadcrumb({
        category: 'nfc',
        message: 'NFC write started',
      });

      if (!isSupported) {
        setState('idle');
        setError(unsupportedNfcMessage());
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

          const record = payload.kind === 'url'
            ? Ndef.uriRecord(payload.value)
            : Ndef.textRecord(payload.value);
          const message = Ndef.encodeMessage([record]);

          if (!message) {
            throw new Error('Failed to encode NFC message');
          }

          await NfcManager.ndefHandler.writeNdefMessage(message);

          const nextTag: NFCTag = {
            ...parsed,
            url: payload.kind === 'url' ? payload.value : undefined,
            payloadKind: payload.kind,
            payloadValue: payload.value,
            displayValue: payload.displayValue ?? getPayloadPreview(payload.kind, payload.value, payload.slug),
            slug: payload.slug,
          };

          setTag(nextTag);
          setState('written');
          await appendLocalNfcHistory(toHistoryEntry(nextTag, 'write', payload.templateId));
          await nfcApi.write({
            uid: parsed.uid,
            url: payload.kind === 'url' ? payload.value : undefined,
            slug: payload.slug,
            payloadKind: payload.kind,
            payloadValue: payload.value,
            displayValue: nextTag.displayValue,
            templateId: payload.templateId,
          });
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
      setError(unsupportedNfcMessage());
      return;
    }

    setState('verifying');
    setError(null);

    try {
      await withNdefTag(async (rawTag) => {
        const parsed = parseTag(rawTag);
        setTag(parsed);
        setState('verified');
        await appendLocalNfcHistory(toHistoryEntry(parsed, 'verify'));
        await nfcApi.markVerified({ uid: parsed.uid, url: parsed.url });
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
        setError(unsupportedNfcMessage());
        return;
      }

      setState('locking');
      setError(null);

      try {
        await withNdefTag(async (rawTag) => {
          const parsed = parseTag(rawTag);

          await nfcApi.lock({ password, uid: parsed.uid });

          const nextTag = { ...parsed, isLocked: true };
          setTag(nextTag);
          setState('locked');
          await appendLocalNfcHistory(toHistoryEntry(nextTag, 'lock'));
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
    writePayload,
    verify,
    lock,
    reset,
  };
}
