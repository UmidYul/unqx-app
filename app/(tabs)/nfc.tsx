import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Clock, Info, Lock, ShieldCheck } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { ScreenTransition } from '@/components/ScreenTransition';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCircle } from '@/components/ui/skeleton';
import { CheckCircle, DotsLoader, Label, NFCRings, Pill, Row, ScanArea } from '@/components/ui/shared';
import { MESSAGES } from '@/constants/messages';
import { NFC_PROTECTED_TAG_ERROR, useNFC } from '@/hooks/useNFC';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useStoreReview } from '@/hooks/useStoreReview';
import { nfcApi } from '@/lib/apiClient';
import { markPushTrigger } from '@/lib/pushPrompt';
import { queryKeys } from '@/lib/queryKeys';
import { NFCHistoryItem } from '@/types';
import { useNfcStore } from '@/store/nfcStore';
import { useThemeContext } from '@/theme/ThemeProvider';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { extractSlug, getProfileURL } from '@/utils/links';
import { toast } from '@/utils/toast';
import Animated, { FadeIn } from 'react-native-reanimated';

type NfcTab = 'read' | 'write' | 'verify' | 'batch' | 'lock';

function parseHistoryPayload(raw: unknown): NFCHistoryItem[] {
  const source = (raw as { items?: unknown[] })?.items ?? raw;
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item: any, index) => ({
      id: String(item?.id ?? `row-${index}`),
      slug: extractSlug(item?.slug ?? item?.url ?? '') ?? '',
      uid: item?.uid,
      type:
        item?.type === 'read' || item?.type === 'write' || item?.type === 'verify' || item?.type === 'lock'
          ? item.type
          : 'read',
      timestamp: String(item?.timestamp ?? item?.createdAt ?? item?.viewedAt ?? ''),
    }))
    .filter((item) => Boolean(item.slug))
    .slice(0, 8);
}

function formatHistoryTime(value: string, isUz: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(isUz ? 'uz-UZ' : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cleanLetters(value: string): string {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
}

function cleanDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

export default function NfcPage(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();
  const isUz = language === 'uz';
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const { incrementSuccess, maybeAskReview } = useStoreReview();
  const { isSupported, state, tag, error, startRead, writeURL, verify, lock, reset } = useNFC();

  const [activeTab, setActiveTab] = React.useState<NfcTab>('read');
  const [letters, setLetters] = React.useState('');
  const [digits, setDigits] = React.useState('');
  const [lockPassword, setLockPassword] = React.useState('');
  const [batchCount, setBatchCount] = React.useState(0);

  const digitsRef = React.useRef<TextInput | null>(null);
  const prevStateRef = React.useRef(state);
  const batchPendingRef = React.useRef(false);

  const setNfcState = useNfcStore((store) => store.setNfcState);
  const setCurrentTag = useNfcStore((store) => store.setCurrentTag);

  const slug = `${letters}${digits}`;
  const slugReady = letters.length === 3 && digits.length === 3;
  const nfcUnavailable = !isSupported;
  const targetUrl = React.useMemo(() => getProfileURL(slug, 'nfc'), [slug]);

  const scannedSlug = React.useMemo(() => extractSlug(tag?.url ?? ''), [tag?.url]);
  const scannedTitle = isUz ? 'NFC teg' : 'NFC метка';

  const nfcText = isUz
    ? {
      tabs: { read: "O'qish", write: 'Yozish', verify: 'Tekshirish', batch: 'Batch', lock: 'Himoya' },
      readTapToScan: 'Skanerlash uchun bosing',
      readBringTag: 'Tegni yaqinlashtiring...',
      readTagRead: "Teg o'qildi",
      premium: 'Premium',
      readAgain: 'Yana bir marta',
      open: 'Ochish',
      letters: 'Harflar',
      digits: 'Raqamlar',
      writeBringTag: 'NFC tegni yaqinlashtiring',
      writing: 'Yozilmoqda...',
      writeDone: 'Muvaffaqiyatli yozildi',
      writeToTag: 'Tegga yozish',
      writeAgain: 'Yana yozish',
      verifyInfo: "Istalgan NFC tegni yaqinlashtiring. Ilova turini, sig'imini va ma'lumotlarini tekshiradi.",
      verifyTap: 'Tekshirish uchun bosing',
      verifyReading: "Teg o'qilmoqda...",
      verifyOk: 'Teg soz',
      verifyType: 'Turi',
      verifyCapacity: "Sig'im",
      verifyUsed: 'Band',
      verifyFree: 'Bo\'sh',
      verifyStatus: 'Holat',
      verifyData: "Ma'lumotlar",
      secured: 'Himoyalangan',
      notSecured: 'Himoyasiz',
      verifyButton: 'Tegni tekshirish',
      verifyAgain: 'Yana tekshirish',
      batchInfo: 'Batch rejimi: bitta havolani ketma-ket ko\'p teglarga yozing.',
      tagsWritten: 'Yozilgan teglar',
      bringTag: 'Tegni yaqinlashtiring',
      batchTagWritten: 'Teg #%1 yozildi',
      batchNext: 'Keyingi #%1',
      batchStart: 'Yozishni boshlash',
      batchFinish: 'Yakunlash · %1 dona',
      lockWarning: 'Diqqat',
      lockInfo: 'Parol himoyasi qayta yozishni bloklaydi. Parolni unutsangiz, tegni ochib bo\'lmaydi.',
      lockPasswordLabel: 'Teg uchun parol',
      lockPasswordHint: '4 dan 8 tagacha belgi',
      lockBringTag: 'Himoya uchun tegni yaqinlashtiring',
      locking: "Parol o'rnatilmoqda...",
      locked: 'Teg himoyalandi',
      lockButton: 'Tegni himoyalash',
      lockAgain: 'Yana himoyalash',
      unsupported: 'Bu qurilmada NFC mavjud emas. O\'qish va yozish o\'chirilgan.',
      historyEmptyTitle: 'Tarix bo\'sh',
      historyEmptySubtitle: 'Teglarni skanerlang yoki yozing',
      historyAction: 'Skanerlash',
      noData: '—',
    }
    : {
      tabs: { read: 'Читать', write: 'Записать', verify: 'Проверить', batch: 'Batch', lock: 'Защита' },
      readTapToScan: 'Нажми для сканирования',
      readBringTag: 'Поднеси метку...',
      readTagRead: 'Метка прочитана',
      premium: 'Премиум',
      readAgain: 'Ещё раз',
      open: 'Открыть',
      letters: 'Буквы',
      digits: 'Цифры',
      writeBringTag: 'Поднеси NFC-метку',
      writing: 'Записываю...',
      writeDone: 'Успешно записано',
      writeToTag: 'Записать в метку',
      writeAgain: 'Записать ещё',
      verifyInfo: 'Поднеси любую NFC-метку. Приложение проверит тип, ёмкость и данные.',
      verifyTap: 'Нажми чтобы проверить',
      verifyReading: 'Читаю метку...',
      verifyOk: 'Метка исправна',
      verifyType: 'Тип',
      verifyCapacity: 'Ёмкость',
      verifyUsed: 'Занято',
      verifyFree: 'Свободно',
      verifyStatus: 'Статус',
      verifyData: 'Данные',
      secured: 'С защитой',
      notSecured: 'Без защиты',
      verifyButton: 'Проверить метку',
      verifyAgain: 'Проверить ещё',
      batchInfo: 'Batch-режим: пиши одну ссылку на множество меток подряд.',
      tagsWritten: 'Записано меток',
      bringTag: 'Поднеси метку',
      batchTagWritten: 'Метка #%1 записана',
      batchNext: 'Следующая #%1',
      batchStart: 'Начать запись',
      batchFinish: 'Завершить · %1 шт.',
      lockWarning: 'Внимание',
      lockInfo: 'Защита паролем блокирует перезапись. Если забудешь — метку нельзя разблокировать.',
      lockPasswordLabel: 'Пароль для метки',
      lockPasswordHint: 'От 4 до 8 символов',
      lockBringTag: 'Поднеси метку для защиты',
      locking: 'Устанавливаю пароль...',
      locked: 'Метка защищена',
      lockButton: 'Защитить метку',
      lockAgain: 'Защитить ещё',
      unsupported: 'На этом устройстве NFC недоступен. Чтение и запись отключены.',
      historyEmptyTitle: 'История пуста',
      historyEmptySubtitle: 'Сканируй или записывай метки',
      historyAction: 'Сканировать',
      noData: '—',
    };

  const tabs: Array<{ id: NfcTab; label: string }> = [
    { id: 'read', label: nfcText.tabs.read },
    { id: 'write', label: nfcText.tabs.write },
    { id: 'verify', label: nfcText.tabs.verify },
    { id: 'batch', label: nfcText.tabs.batch },
    { id: 'lock', label: nfcText.tabs.lock },
  ];

  React.useEffect(() => {
    setNfcState(state);
    setCurrentTag(tag);
  }, [setCurrentTag, setNfcState, state, tag]);

  const historyQuery = useQuery({
    queryKey: queryKeys.nfcHistory,
    queryFn: nfcApi.history,
  });
  const tagsQuery = useQuery({
    queryKey: queryKeys.nfcTags,
    queryFn: nfcApi.tags,
  });
  const isRefreshing = historyQuery.isRefetching || tagsQuery.isRefetching;
  const onRefresh = React.useCallback(async () => {
    await Promise.all([historyQuery.refetch(), tagsQuery.refetch()]);
  }, [historyQuery, tagsQuery]);
  const history = React.useMemo(() => parseHistoryPayload(historyQuery.data), [historyQuery.data]);

  React.useEffect(() => {
    const prev = prevStateRef.current;

    if ((state === 'success' || state === 'written' || state === 'verified' || state === 'locked') && prev !== state) {
      void markPushTrigger('nfc').catch(() => undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: queryKeys.nfcHistory });

      if (state === 'written') {
        toast.success(MESSAGES.toast.nfcWritten);
      }

      if (state === 'success' || state === 'written') {
        void incrementSuccess().then(() => maybeAskReview()).catch(() => undefined);
      }

      if (state === 'written' && batchPendingRef.current) {
        setBatchCount((count) => count + 1);
        batchPendingRef.current = false;
      }
    }

    prevStateRef.current = state;
  }, [queryClient, state]);

  React.useEffect(() => {
    if (error) {
      const readableError = error === NFC_PROTECTED_TAG_ERROR
        ? (isUz ? 'Teg himoyalangan. Unga yozib bo\'lmaydi.' : 'Метка защищена. Запись невозможна.')
        : error;
      toast.error(MESSAGES.toast.nfcWriteError, readableError);
    }
  }, [error, isUz]);

  const switchTab = React.useCallback(
    (tab: NfcTab) => {
      setActiveTab(tab);
      reset();
      if (tab !== 'batch') {
        batchPendingRef.current = false;
      }
    },
    [reset],
  );

  const handleLetters = React.useCallback((value: string) => {
    const next = cleanLetters(value);
    setLetters(next);
    if (next.length === 3) {
      digitsRef.current?.focus();
    }
  }, []);

  const handleDigits = React.useCallback((value: string) => {
    setDigits(cleanDigits(value));
  }, []);

  const handleRead = React.useCallback(() => {
    void startRead();
  }, [startRead]);

  const handleWrite = React.useCallback(() => {
    if (!slugReady) return;
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    void writeURL(targetUrl);
  }, [isOnline, slugReady, targetUrl, writeURL]);

  const handleVerify = React.useCallback(() => {
    void verify();
  }, [verify]);

  const handleNextBatch = React.useCallback(() => {
    if (!slugReady) return;
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    batchPendingRef.current = true;
    void writeURL(targetUrl);
  }, [isOnline, slugReady, targetUrl, writeURL]);

  const handleLock = React.useCallback(() => {
    if (lockPassword.length < 4) return;
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    void lock(lockPassword);
  }, [isOnline, lock, lockPassword]);

  const handleOpen = React.useCallback(() => {
    if (tag?.url) {
      void Linking.openURL(tag.url);
    }
  }, [tag?.url]);
  const writePending = state === 'writing';
  const lockPending = state === 'locking';

  const renderRead = (): React.JSX.Element => (
    <View style={styles.tabSection}>
      <ScanArea active={state === 'scanning'} tokens={tokens} onPress={state === 'idle' && !nfcUnavailable ? handleRead : undefined} minHeight={250}>
        {state === 'idle' ? (
          <>
            <NFCRings active={false} tokens={tokens} />
            <Text style={[styles.scanHint, { color: tokens.textMuted }]}>{nfcText.readTapToScan}</Text>
          </>
        ) : null}

        {state === 'scanning' ? (
          <>
            <NFCRings active tokens={tokens} />
            <DotsLoader color={tokens.accent} />
            <Text style={[styles.scanSub, { color: tokens.textMuted }]}>{nfcText.readBringTag}</Text>
          </>
        ) : null}

        {state === 'success' ? (
          <View style={styles.resultCardWrap}>
            <View style={styles.successIconWrap}>
              <CheckCircle tokens={tokens} />
            </View>
            <Text style={[styles.resultLabel, { color: tokens.textMuted }]}>{nfcText.readTagRead}</Text>
            <View style={[styles.resultCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
              <View style={styles.resultTop}>
                <View style={[styles.resultAvatar, { backgroundColor: `${tokens.accent}14` }]}>
                  <Text style={[styles.resultAvatarText, { color: tokens.accent }]}>{scannedTitle[0]}</Text>
                </View>
                <View>
                  <Text style={[styles.resultName, { color: tokens.text }]}>{scannedTitle}</Text>
                </View>
              </View>
              <Row
                label='UNQ'
                value={scannedSlug ? `unqx.uz/${scannedSlug}` : nfcText.noData}
                textColor={tokens.text}
                mutedColor={tokens.textMuted}
                borderColor={tokens.border}
              />
              <Row label='UID' value={tag?.uid ?? nfcText.noData} textColor={tokens.text} mutedColor={tokens.textMuted} borderColor={tokens.border} last />
            </View>
          </View>
        ) : null}
      </ScanArea>

      {state === 'idle' ? (
        <AnimatedPressable
          style={[styles.primaryBtn, { backgroundColor: tokens.accent, borderColor: tokens.accent, opacity: nfcUnavailable ? 0.5 : 1 }]}
          onPress={handleRead}
          disabled={nfcUnavailable}
        >
          <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>{MESSAGES.ui.nfc.scanButton}</Text>
        </AnimatedPressable>
      ) : null}

      {state === 'success' ? (
        <View style={styles.dualBtns}>
          <AnimatedPressable style={[styles.secondaryBtn, styles.flexBtn, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={reset}>
            <Text style={[styles.secondaryBtnText, { color: tokens.text }]}>{nfcText.readAgain}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={[styles.primaryBtn, styles.flexBtn, { backgroundColor: tokens.accent, borderColor: tokens.accent }]} onPress={handleOpen}>
            <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>{nfcText.open}</Text>
          </AnimatedPressable>
        </View>
      ) : null}
    </View>
  );

  const renderWrite = (): React.JSX.Element => (
    <View style={styles.tabSection}>
      <View style={styles.inputsRow}>
        <View style={styles.inputCol}>
          <Label color={tokens.textMuted}>{nfcText.letters}</Label>
          <TextInput
            value={letters}
            onChangeText={handleLetters}
            autoCapitalize='characters'
            maxLength={3}
            placeholder='ABC'
            placeholderTextColor={tokens.textMuted}
            editable={state !== 'writing' && state !== 'written'}
            style={[
              styles.slugInput,
              {
                backgroundColor: tokens.inputBg,
                borderColor: letters.length === 3 ? tokens.borderStrong : tokens.border,
                color: tokens.text,
              },
            ]}
          />
        </View>

        <Text style={[styles.midDot, { color: tokens.textMuted }]}>·</Text>

        <View style={styles.inputCol}>
          <Label color={tokens.textMuted}>{nfcText.digits}</Label>
          <TextInput
            ref={digitsRef}
            value={digits}
            onChangeText={handleDigits}
            keyboardType='number-pad'
            maxLength={3}
            placeholder='000'
            placeholderTextColor={tokens.textMuted}
            editable={state !== 'writing' && state !== 'written'}
            style={[
              styles.slugInput,
              {
                backgroundColor: tokens.inputBg,
                borderColor: digits.length === 3 ? tokens.borderStrong : tokens.border,
                color: tokens.text,
              },
            ]}
          />
        </View>
      </View>

      <ScanArea active={state === 'writing'} tokens={tokens} minHeight={200}>
        {state === 'idle' ? (
          <>
            <NFCRings active={false} tokens={tokens} />
            <Text style={[styles.scanHint, { color: tokens.textMuted }]}>{nfcText.writeBringTag}</Text>
          </>
        ) : null}

        {state === 'writing' ? (
          <>
            <NFCRings active tokens={tokens} />
            <DotsLoader color={tokens.accent} />
            <Text style={[styles.scanSub, { color: tokens.textMuted }]}>{nfcText.writing}</Text>
          </>
        ) : null}

        {state === 'written' ? (
          <View style={styles.writeDoneWrap}>
            <View style={styles.successIconWrap}>
              <CheckCircle tokens={tokens} />
            </View>
            <Text style={[styles.writeDoneTitle, { color: tokens.text }]}>{nfcText.writeDone}</Text>
            <View style={[styles.writeDoneSlug, { backgroundColor: tokens.surface }]}>
              <Text style={[styles.writeDoneSlugText, { color: tokens.text }]}>{slug}</Text>
            </View>
          </View>
        ) : null}
      </ScanArea>

      {(state === 'idle' || state === 'writing') ? (
        <AnimatedPressable
          style={[
            styles.primaryBtn,
            {
              backgroundColor: slugReady ? tokens.accent : tokens.surface,
              borderColor: slugReady ? tokens.accent : tokens.border,
              opacity: slugReady && !writePending && !nfcUnavailable ? 1 : 0.5,
            },
          ]}
          disabled={!slugReady || writePending || nfcUnavailable}
          onPress={handleWrite}
        >
          {writePending ? (
            <ActivityIndicator color={tokens.accentText} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: slugReady ? tokens.accentText : tokens.text }]}>{nfcText.writeToTag}</Text>
          )}
        </AnimatedPressable>
      ) : null}

      {state === 'written' ? (
        <AnimatedPressable style={[styles.secondaryBtn, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={reset}>
          <Text style={[styles.secondaryBtnText, { color: tokens.text }]}>{nfcText.writeAgain}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );

  const renderVerify = (): React.JSX.Element => (
    <View style={styles.tabSection}>
      <View style={[styles.infoCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
        <Text style={[styles.infoText, { color: tokens.textSub }]}>{nfcText.verifyInfo}</Text>
      </View>

      <ScanArea active={state === 'verifying'} tokens={tokens} onPress={state === 'idle' && !nfcUnavailable ? handleVerify : undefined} minHeight={230}>
        {state === 'idle' ? (
          <>
            <NFCRings active={false} tokens={tokens} />
            <Text style={[styles.scanHint, { color: tokens.textMuted }]}>{nfcText.verifyTap}</Text>
          </>
        ) : null}

        {state === 'verifying' ? (
          <>
            <NFCRings active tokens={tokens} />
            <DotsLoader color={tokens.accent} />
            <Text style={[styles.scanSub, { color: tokens.textMuted }]}>{nfcText.verifyReading}</Text>
          </>
        ) : null}

        {state === 'verified' ? (
          <View style={styles.verifyWrap}>
            <View style={styles.verifyHead}>
              <CheckCircle tokens={tokens} />
              <Text style={[styles.verifyHeadText, { color: tokens.text }]}>{nfcText.verifyOk}</Text>
            </View>

            {[
              [nfcText.verifyType, tag?.type ?? nfcText.noData],
              [nfcText.verifyCapacity, typeof tag?.capacity === 'number' ? `${tag.capacity} ${isUz ? 'bayt' : 'байт'}` : nfcText.noData],
              [nfcText.verifyUsed, typeof tag?.used === 'number' ? `${tag.used} ${isUz ? 'bayt' : 'байт'}` : nfcText.noData],
              [
                nfcText.verifyFree,
                typeof tag?.capacity === 'number' && typeof tag?.used === 'number'
                  ? `${Math.max(0, tag.capacity - tag.used)} ${isUz ? 'bayt' : 'байт'}`
                  : nfcText.noData,
              ],
              [nfcText.verifyStatus, tag?.isLocked ? nfcText.secured : nfcText.notSecured],
              [nfcText.verifyData, tag?.url ?? nfcText.noData],
            ].map(([k, v], idx, arr) => (
              <View
                key={k}
                style={[
                  styles.verifyRow,
                  {
                    borderBottomColor: tokens.border,
                    borderBottomWidth: idx === arr.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <Text style={[styles.verifyKey, { color: tokens.textMuted }]}>{k}</Text>
                <Text style={[styles.verifyValue, { color: tokens.text }]}>{v}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScanArea>

      {state === 'idle' ? (
        <AnimatedPressable
          style={[styles.primaryBtn, { backgroundColor: tokens.accent, borderColor: tokens.accent, opacity: nfcUnavailable ? 0.5 : 1 }]}
          onPress={handleVerify}
          disabled={nfcUnavailable}
        >
          <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>{nfcText.verifyButton}</Text>
        </AnimatedPressable>
      ) : null}

      {state === 'verified' ? (
        <AnimatedPressable style={[styles.secondaryBtn, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={reset}>
          <Text style={[styles.secondaryBtnText, { color: tokens.text }]}>{nfcText.verifyAgain}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );

  const renderBatch = (): React.JSX.Element => (
    <View style={styles.tabSection}>
      <View style={[styles.infoCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
        <Text style={[styles.infoText, { color: tokens.textSub }]}>{nfcText.batchInfo}</Text>
      </View>

      <View style={styles.inputsRow}>
        <View style={styles.inputCol}>
          <Label color={tokens.textMuted}>{nfcText.letters}</Label>
          <TextInput
            value={letters}
            onChangeText={handleLetters}
            autoCapitalize='characters'
            maxLength={3}
            placeholder='ABC'
            placeholderTextColor={tokens.textMuted}
            style={[styles.slugInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
          />
        </View>

        <Text style={[styles.midDot, { color: tokens.textMuted }]}>·</Text>

        <View style={styles.inputCol}>
          <Label color={tokens.textMuted}>{nfcText.digits}</Label>
          <TextInput
            value={digits}
            onChangeText={handleDigits}
            keyboardType='number-pad'
            maxLength={3}
            placeholder='000'
            placeholderTextColor={tokens.textMuted}
            style={[styles.slugInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
          />
        </View>
      </View>

      <View style={[styles.batchCounter, { borderColor: `${tokens.accent}30`, backgroundColor: `${tokens.accent}10` }]}>
        <Text style={[styles.batchCount, { color: tokens.accent }]}>{batchCount}</Text>
        <View>
          <Text style={[styles.batchTitle, { color: tokens.text }]}>{nfcText.tagsWritten}</Text>
          <Text style={[styles.batchSub, { color: tokens.textMuted }]}>{`/${letters || '___'}${digits || '000'}`}</Text>
        </View>
      </View>

      <ScanArea active={state === 'writing'} tokens={tokens} minHeight={150}>
        {state === 'idle' ? (
          <>
            <NFCRings active={false} tokens={tokens} />
            <Text style={[styles.scanHint, { color: tokens.textMuted }]}>{nfcText.bringTag}</Text>
          </>
        ) : null}

        {state === 'writing' ? (
          <>
            <NFCRings active tokens={tokens} />
            <DotsLoader color={tokens.accent} />
          </>
        ) : null}

        {state === 'written' ? (
          <View style={styles.batchDoneWrap}>
            <CheckCircle tokens={tokens} />
            <Text style={[styles.batchDoneText, { color: tokens.text }]}>{nfcText.batchTagWritten.replace('%1', String(batchCount))}</Text>
          </View>
        ) : null}
      </ScanArea>

      {(state === 'idle' || state === 'written' || state === 'writing') ? (
        <AnimatedPressable
          style={[
            styles.primaryBtn,
            {
              backgroundColor: slugReady ? tokens.accent : tokens.surface,
              borderColor: slugReady ? tokens.accent : tokens.border,
              opacity: slugReady && !writePending && !nfcUnavailable ? 1 : 0.5,
            },
          ]}
          disabled={!slugReady || writePending || nfcUnavailable}
          onPress={handleNextBatch}
        >
          {writePending ? (
            <ActivityIndicator color={tokens.accentText} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: slugReady ? tokens.accentText : tokens.text }]}>
              {state === 'written' ? nfcText.batchNext.replace('%1', String(batchCount + 1)) : nfcText.batchStart}
            </Text>
          )}
        </AnimatedPressable>
      ) : null}

      {batchCount > 0 ? (
        <AnimatedPressable
          style={[styles.secondaryBtn, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onPress={() => {
            reset();
            batchPendingRef.current = false;
            setBatchCount(0);
          }}
        >
          <Text style={[styles.secondaryBtnText, { color: tokens.text }]}>{nfcText.batchFinish.replace('%1', String(batchCount))}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );

  const renderLock = (): React.JSX.Element => (
    <View style={styles.tabSection}>
      <View style={[styles.warnCard, { borderColor: `${tokens.amber}50`, backgroundColor: tokens.amberBg }]}>
        <View style={styles.warnHead}>
          <Lock size={13} strokeWidth={1.5} color={tokens.amber} />
          <Text style={[styles.warnTitle, { color: tokens.amber }]}>{nfcText.lockWarning}</Text>
        </View>
        <Text style={[styles.warnText, { color: tokens.textSub }]}>{nfcText.lockInfo}</Text>
      </View>

      <View style={styles.inputCol}>
        <Label color={tokens.textMuted}>{nfcText.lockPasswordLabel}</Label>
        <TextInput
          value={lockPassword}
          onChangeText={setLockPassword}
          secureTextEntry
          maxLength={8}
          placeholder='••••'
          placeholderTextColor={tokens.textMuted}
          editable={state !== 'locking' && state !== 'locked'}
          style={[
            styles.passwordInput,
            {
              backgroundColor: tokens.inputBg,
              borderColor: lockPassword ? tokens.borderStrong : tokens.border,
              color: tokens.text,
            },
          ]}
        />
        <Text style={[styles.passwordHint, { color: tokens.textMuted }]}>{nfcText.lockPasswordHint}</Text>
      </View>

      <ScanArea active={state === 'locking'} tokens={tokens} minHeight={190}>
        {state === 'idle' ? (
          <>
            <NFCRings active={false} tokens={tokens} />
            <Text style={[styles.scanHint, { color: tokens.textMuted }]}>{nfcText.lockBringTag}</Text>
          </>
        ) : null}

        {state === 'locking' ? (
          <>
            <NFCRings active tokens={tokens} />
            <DotsLoader color={tokens.accent} />
            <Text style={[styles.scanSub, { color: tokens.textMuted }]}>{nfcText.locking}</Text>
          </>
        ) : null}

        {state === 'locked' ? (
          <View style={styles.lockDoneWrap}>
            <View style={[styles.lockIconWrap, { backgroundColor: tokens.amberBg, borderColor: tokens.amber }]}>
              <ShieldCheck size={16} strokeWidth={1.8} color={tokens.amber} />
            </View>
            <Text style={[styles.lockDoneText, { color: tokens.text }]}>{nfcText.locked}</Text>
          </View>
        ) : null}
      </ScanArea>

      {(state === 'idle' || state === 'locking') ? (
        <AnimatedPressable
          style={[
            styles.primaryBtn,
            {
              backgroundColor: lockPassword.length >= 4 ? tokens.accent : tokens.surface,
              borderColor: lockPassword.length >= 4 ? tokens.accent : tokens.border,
              opacity: lockPassword.length >= 4 && !lockPending && !nfcUnavailable ? 1 : 0.5,
            },
          ]}
          disabled={lockPassword.length < 4 || lockPending || nfcUnavailable}
          onPress={handleLock}
        >
          {lockPending ? (
            <ActivityIndicator color={tokens.accentText} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: lockPassword.length >= 4 ? tokens.accentText : tokens.text }]}>{nfcText.lockButton}</Text>
          )}
        </AnimatedPressable>
      ) : null}

      {state === 'locked' ? (
        <AnimatedPressable
          style={[styles.secondaryBtn, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onPress={() => {
            reset();
            setLockPassword('');
          }}
        >
          <Text style={[styles.secondaryBtnText, { color: tokens.text }]}>{nfcText.lockAgain}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );

  return (
    <ErrorBoundary>
      <AppShell title={MESSAGES.ui.screens.nfc} tokens={tokens}>
        <ScreenTransition>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={tokens.accent} colors={[tokens.accent]} />}
          >
            {historyQuery.isError && !historyQuery.data ? (
              <ErrorState
                tokens={tokens}
                text={MESSAGES.query.nfcHistoryLoadFailed}
                onRetry={() => {
                  void historyQuery.refetch();
                }}
              />
            ) : null}

            {!historyQuery.isError || historyQuery.data ? (
              <>
                {!isSupported ? (
                  <View style={[styles.unsupported, { borderColor: `${tokens.blue}55`, backgroundColor: tokens.blueBg }]}>
                    <Info size={15} strokeWidth={1.5} color={tokens.blue} />
                    <Text style={[styles.unsupportedText, { color: tokens.textSub }]}>{nfcText.unsupported}</Text>
                  </View>
                ) : null}

                <View style={[styles.tabsWrap, { borderBottomColor: tokens.border }]}>
                  {tabs.map((tab) => (
                    <AnimatedPressable
                      key={tab.id}
                      onPress={() => switchTab(tab.id)}
                      style={styles.tabBtn}
                      containerStyle={styles.tabWrap}
                    >
                      <Text style={[styles.tabText, { color: activeTab === tab.id ? tokens.text : tokens.textMuted }]}>{tab.label}</Text>
                      <View style={[styles.tabLine, { backgroundColor: activeTab === tab.id ? tokens.accent : 'transparent' }]} />
                    </AnimatedPressable>
                  ))}
                </View>

                <Animated.View key={activeTab} entering={FadeIn.duration(170)}>
                  {activeTab === 'read' ? renderRead() : null}
                  {activeTab === 'write' ? renderWrite() : null}
                  {activeTab === 'verify' ? renderVerify() : null}
                  {activeTab === 'batch' ? renderBatch() : null}
                  {activeTab === 'lock' ? renderLock() : null}
                </Animated.View>

                {error ? <Text style={[styles.errorText, { color: tokens.red }]}>{error}</Text> : null}

                <View style={styles.historyWrap}>
                  <Label color={tokens.textMuted} style={styles.historyLabel}>{MESSAGES.ui.nfc.history}</Label>
                  {historyQuery.isLoading ? (
                    <>
                      {[0, 1].map((idx) => (
                        <View key={`history-sk-${idx}`} style={styles.historyRow}>
                          <View style={styles.historyLeft}>
                            <SkeletonCircle tokens={tokens} size={32} />
                            <View style={{ gap: 5, width: 160 }}>
                              <SkeletonBlock tokens={tokens} height={10} width='78%' />
                              <SkeletonBlock tokens={tokens} height={9} width='52%' />
                            </View>
                          </View>
                          <SkeletonBlock tokens={tokens} height={10} width={10} />
                        </View>
                      ))}
                    </>
                  ) : null}
                  {!historyQuery.isLoading && history.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title={nfcText.historyEmptyTitle}
                      subtitle={nfcText.historyEmptySubtitle}
                      tokens={tokens}
                      action={{
                        label: nfcText.historyAction,
                        onPress: () => {
                          switchTab('read');
                          handleRead();
                        },
                      }}
                    />
                  ) : null}

                  {history.map((item, index, arr) => (
                    <View
                      key={item.id}
                      style={[
                        styles.historyRow,
                        {
                          borderBottomColor: tokens.border,
                          borderBottomWidth: index === arr.length - 1 ? 0 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <View style={styles.historyLeft}>
                        <View
                          style={[
                            styles.historyType,
                            {
                              backgroundColor: item.type === 'read' ? tokens.surface : `${tokens.accent}14`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.historyTypeText,
                              {
                                color: item.type === 'read' ? tokens.textSub : tokens.accent,
                              },
                            ]}
                          >
                            {item.type === 'read' ? 'R' : item.type === 'write' ? 'W' : item.type === 'verify' ? 'V' : 'L'}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.historySlug, { color: tokens.text }]}>
                            {item.slug ? <Text style={[styles.historyPrefix, { color: tokens.textMuted }]}>unqx.uz/</Text> : null}
                            {item.slug || nfcText.noData}
                          </Text>
                          <Text style={[styles.historyTime, { color: tokens.textMuted }]}>{formatHistoryTime(item.timestamp, isUz)}</Text>
                        </View>
                      </View>

                      <Text style={[styles.historyChevron, { color: tokens.textMuted }]}>›</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>
        </ScreenTransition>
      </AppShell>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  tabSection: {
    marginTop: 14,
    gap: 14,
  },
  unsupported: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  unsupportedText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  tabsWrap: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 2,
  },
  tabWrap: {
    flex: 1,
  },
  tabBtn: {
    minHeight: 44,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  tabLine: {
    width: '70%',
    height: 2,
    borderRadius: 2,
  },
  scanHint: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  scanSub: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  flexBtn: {
    flex: 1,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  dualBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  resultCardWrap: {
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  successIconWrap: {
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
    marginBottom: 12,
  },
  resultCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 4,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  resultName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inputCol: {
    flex: 1,
    gap: 6,
  },
  midDot: {
    fontSize: 20,
    paddingTop: 22,
    fontFamily: 'Inter_400Regular',
  },
  slugInput: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  writeDoneWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  writeDoneTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
  },
  writeDoneSlug: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  writeDoneSlugText: {
    fontSize: 18,
    letterSpacing: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  verifyWrap: {
    width: '100%',
    paddingHorizontal: 20,
  },
  verifyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  verifyHeadText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  verifyRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  verifyKey: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  verifyValue: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    maxWidth: '62%',
    textAlign: 'right',
  },
  batchCounter: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  batchCount: {
    fontSize: 36,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 38,
  },
  batchTitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  batchSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  batchDoneWrap: {
    alignItems: 'center',
    gap: 8,
  },
  batchDoneText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  warnCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  warnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  warnTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  warnText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  passwordInput: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    textAlign: 'center',
    letterSpacing: 6,
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
  },
  passwordHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  lockDoneWrap: {
    alignItems: 'center',
    gap: 10,
  },
  lockIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockDoneText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  historyWrap: {
    marginTop: 6,
  },
  historyLabel: {
    marginBottom: 12,
  },
  historyLoading: {
    marginBottom: 10,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  historyRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  historyType: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTypeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  historySlug: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
  historyPrefix: {
    fontSize: 11,
    letterSpacing: 0,
    fontFamily: 'Inter_400Regular',
  },
  historyTime: {
    marginTop: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  historyChevron: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingRight: 2,
  },
});
