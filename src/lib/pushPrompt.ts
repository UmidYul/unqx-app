import { storageGetItem, storageSetItem } from '@/lib/secureStorage';

const PUSH_TRIGGER_NFC_KEY = 'unqx.push.trigger.nfc';
const PUSH_TRIGGER_ANALYTICS_KEY = 'unqx.push.trigger.analytics';
const PUSH_PROMPT_DISMISSED_KEY = 'unqx.push.prompt.dismissed';
const PUSH_PERMISSION_REQUESTED_KEY = 'unqx.push.permission.requested';

export async function markPushTrigger(source: 'nfc' | 'analytics'): Promise<void> {
  const key = source === 'nfc' ? PUSH_TRIGGER_NFC_KEY : PUSH_TRIGGER_ANALYTICS_KEY;
  await storageSetItem(key, '1');
}

export async function dismissPushPromptPermanently(): Promise<void> {
  await storageSetItem(PUSH_PROMPT_DISMISSED_KEY, '1');
}

export async function markPushPermissionRequested(): Promise<void> {
  await storageSetItem(PUSH_PERMISSION_REQUESTED_KEY, '1');
}

export async function getPushPromptState(): Promise<{
  shouldPrompt: boolean;
  permissionRequested: boolean;
}> {
  const [nfcTrigger, analyticsTrigger, dismissed, requested] = await Promise.all([
    storageGetItem(PUSH_TRIGGER_NFC_KEY),
    storageGetItem(PUSH_TRIGGER_ANALYTICS_KEY),
    storageGetItem(PUSH_PROMPT_DISMISSED_KEY),
    storageGetItem(PUSH_PERMISSION_REQUESTED_KEY),
  ]);

  const permissionRequested = requested === '1';
  if (dismissed === '1' || permissionRequested) {
    return {
      shouldPrompt: false,
      permissionRequested,
    };
  }

  return {
    shouldPrompt: true,
    permissionRequested,
  };
}
