import AsyncStorage from '@react-native-async-storage/async-storage';

import { NFCHistoryItem } from '@/types';

const NFC_LOCAL_HISTORY_KEY = 'unqx.nfc.local-history.v1';
const NFC_LOCAL_HISTORY_LIMIT = 20;

function normalizeHistoryItem(raw: any, index: number): NFCHistoryItem {
  return {
    id: String(raw?.id ?? `nfc-local-${index}`),
    slug: typeof raw?.slug === 'string' ? raw.slug : undefined,
    uid: raw?.uid ? String(raw.uid) : undefined,
    type: raw?.type === 'write' || raw?.type === 'verify' || raw?.type === 'lock' ? raw.type : 'read',
    timestamp: String(raw?.timestamp ?? ''),
    payloadKind: raw?.payloadKind === 'url' || raw?.payloadKind === 'text' ? raw.payloadKind : 'unknown',
    payloadValue: raw?.payloadValue ? String(raw.payloadValue) : undefined,
    displayValue: raw?.displayValue ? String(raw.displayValue) : undefined,
    templateId: raw?.templateId ? String(raw.templateId) as NFCHistoryItem['templateId'] : undefined,
  };
}

export async function readLocalNfcHistory(): Promise<{ items: NFCHistoryItem[] }> {
  try {
    const raw = await AsyncStorage.getItem(NFC_LOCAL_HISTORY_KEY);
    if (!raw) {
      return { items: [] };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { items: [] };
    }

    return {
      items: parsed
        .map((item, index) => normalizeHistoryItem(item, index))
        .filter((item) => Boolean(item.timestamp)),
    };
  } catch {
    return { items: [] };
  }
}

export async function appendLocalNfcHistory(
  item: Omit<NFCHistoryItem, 'id' | 'timestamp'> & { timestamp?: string },
): Promise<void> {
  const nextItem: NFCHistoryItem = {
    ...item,
    id: `nfc-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: item.timestamp ?? new Date().toISOString(),
  };

  const current = await readLocalNfcHistory();
  const next = [nextItem, ...current.items].slice(0, NFC_LOCAL_HISTORY_LIMIT);

  try {
    await AsyncStorage.setItem(NFC_LOCAL_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // noop
  }
}
