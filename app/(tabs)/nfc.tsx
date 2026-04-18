import React from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ChevronDown, Clock, Info, Lock, ShieldCheck } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScreenTransition } from '@/components/ScreenTransition';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCircle } from '@/components/ui/skeleton';
import { CheckCircle, DotsLoader, Label, NFCRings, Row, ScanArea } from '@/components/ui/shared';
import { MESSAGES } from '@/constants/messages';
import { NFC_PROTECTED_TAG_ERROR, useNFC } from '@/hooks/useNFC';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useStoreReview } from '@/hooks/useStoreReview';
import { readLocalNfcHistory } from '@/lib/nfcLocalHistory';
import { markPushTrigger } from '@/lib/pushPrompt';
import { queryKeys } from '@/lib/queryKeys';
import { NFCHistoryItem, NfcPayloadKind, NfcTemplateId } from '@/types';
import { useNfcStore } from '@/store/nfcStore';
import { useThemeContext } from '@/theme/ThemeProvider';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { buildSlugPayload, buildTemplatePayload, getHistoryPreview, getPayloadPreview } from '@/utils/nfcPayloads';
import { toast } from '@/utils/toast';

type NfcTab = 'read' | 'write' | 'verify' | 'batch' | 'lock';
type WriteMode = 'slug' | 'other';

interface TemplateOption {
  id: Exclude<NfcTemplateId, 'slug'>;
  label: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
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

function getPayloadKindLabel(kind: NfcPayloadKind | undefined, isUz: boolean): string {
  if (kind === 'url') {
    return isUz ? 'Havola' : 'Ссылка';
  }
  if (kind === 'text') {
    return isUz ? 'Matn' : 'Текст';
  }
  return isUz ? "Noma'lum" : 'Неизвестно';
}

function getHistoryTypeMark(type: NFCHistoryItem['type']): string {
  if (type === 'write') {
    return 'W';
  }
  if (type === 'verify') {
    return 'V';
  }
  if (type === 'lock') {
    return 'L';
  }
  return 'R';
}

export default function NfcPage(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();
  const { signedIn } = useAuthStatus();
  const isUz = language === 'uz';
  const queryClient = useQueryClient();
  const { incrementSuccess, maybeAskReview } = useStoreReview();
  const { isSupported, state, tag, error, startRead, writePayload, verify, lock, reset } = useNFC();

  const [activeTab, setActiveTab] = React.useState<NfcTab>('read');
  const [writeMode, setWriteMode] = React.useState<WriteMode>('slug');
  const [letters, setLetters] = React.useState('');
  const [digits, setDigits] = React.useState('');
  const [selectedTemplate, setSelectedTemplate] = React.useState<Exclude<NfcTemplateId, 'slug'>>('telegram');
  const [templatePickerVisible, setTemplatePickerVisible] = React.useState(false);
  const [otherValue, setOtherValue] = React.useState('');
  const [lockPassword, setLockPassword] = React.useState('');
  const [batchCount, setBatchCount] = React.useState(0);

  const digitsRef = React.useRef<TextInput | null>(null);
  const prevStateRef = React.useRef(state);
  const batchPendingRef = React.useRef(false);

  const setNfcState = useNfcStore((store) => store.setNfcState);
  const setCurrentTag = useNfcStore((store) => store.setCurrentTag);

  const slug = `${letters}${digits}`;
  const slugReady = letters.length === 3 && digits.length === 3;
  const slugPayload = React.useMemo(() => (slugReady ? buildSlugPayload(slug) : null), [slug, slugReady]);
  const extraPayload = React.useMemo(() => buildTemplatePayload(selectedTemplate, otherValue), [otherValue, selectedTemplate]);
  const currentPayload = writeMode === 'slug' ? slugPayload : extraPayload;
  const payloadReady = Boolean(currentPayload);
  const nfcUnavailable = !isSupported;
  const scannedPreview = tag?.displayValue ?? getPayloadPreview(tag?.payloadKind, tag?.payloadValue, tag?.slug);

  const templateOptions = React.useMemo<TemplateOption[]>(
    () => [
      {
        id: 'telegram',
        label: 'Telegram',
        placeholder: isUz ? '@username yoki t.me/username' : '@username или t.me/username',
      },
      {
        id: 'instagram',
        label: 'Instagram',
        placeholder: isUz ? '@username yoki instagram.com/username' : '@username или instagram.com/username',
      },
      {
        id: 'site',
        label: isUz ? 'Sayt' : 'Сайт',
        placeholder: isUz ? 'example.com yoki https://example.com' : 'example.com или https://example.com',
        keyboardType: 'url',
      },
      {
        id: 'tiktok',
        label: 'TikTok',
        placeholder: isUz ? '@username yoki tiktok.com/@username' : '@username или tiktok.com/@username',
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        placeholder: isUz ? '+998901234567' : '+998901234567',
        keyboardType: 'phone-pad',
      },
      {
        id: 'phone',
        label: isUz ? 'Telefon' : 'Телефон',
        placeholder: isUz ? '+998901234567' : '+998901234567',
        keyboardType: 'phone-pad',
      },
      {
        id: 'email',
        label: 'Email',
        placeholder: 'hello@example.com',
        keyboardType: 'email-address',
      },
      {
        id: 'plain_text',
        label: isUz ? 'Oddiy matn' : 'Plain text',
        placeholder: isUz ? "Istalgan matnni yozing" : 'Напиши любой текст',
      },
    ],
    [isUz],
  );

  const selectedTemplateMeta = templateOptions.find((item) => item.id === selectedTemplate) ?? templateOptions[0];

  const nfcText = isUz
    ? {
      tabs: { read: "O'qish", write: 'Yozish', verify: 'Tekshirish', batch: 'Batch', lock: 'Himoya' },
      readTapToScan: 'Skanerlash uchun bosing',
      readBringTag: 'Tegni yaqinlashtiring...',
      readTagRead: "Teg o'qildi",
      readAgain: 'Yana bir marta',
      open: 'Ochish',
      copy: 'Nusxa olish',
      payloadType: 'Format',
      payloadValue: "Ma'lumot",
      letters: 'Harflar',
      digits: 'Raqamlar',
      writeMode: 'Yozish rejimi',
      slugMode: 'UNQX slug',
      otherMode: 'Boshqa',
      templates: 'Tayyor shablonlar',
      templatePickerTitle: 'Shablonni tanlang',
      otherValue: "Qiymat",
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
      verifyFree: "Bo'sh",
      verifyStatus: 'Holat',
      verifyPayloadType: 'Payload',
      verifyData: "Ma'lumotlar",
      secured: 'Himoyalangan',
      notSecured: 'Himoyasiz',
      verifyButton: 'Tegni tekshirish',
      verifyAgain: 'Yana tekshirish',
      batchInfo: "Batch rejimi: bitta payload'ni ketma-ket ko'p teglarga yozing.",
      tagsWritten: 'Yozilgan teglar',
      bringTag: 'Tegni yaqinlashtiring',
      batchTagWritten: 'Teg #%1 yozildi',
      batchNext: 'Keyingi #%1',
      batchStart: 'Yozishni boshlash',
      batchFinish: 'Yakunlash · %1 dona',
      lockWarning: 'Diqqat',
      lockInfo: "Parol himoyasi qayta yozishni bloklaydi. Agar unutsangiz, tegni ochib bo'lmaydi.",
      lockPasswordLabel: 'Teg uchun parol',
      lockPasswordHint: '4 dan 8 tagacha belgi',
      lockBringTag: 'Himoya uchun tegni yaqinlashtiring',
      locking: "Parol o'rnatilmoqda...",
      locked: 'Teg himoyalandi',
      lockButton: 'Tegni himoyalash',
      lockAgain: 'Yana himoyalash',
      unsupported: "Bu qurilmada NFC mavjud emas. O'qish va yozish o'chirilgan.",
      historyEmptyTitle: "Tarix bo'sh",
      historyEmptySubtitle: 'Teglarni skanerlang yoki yozing',
      historyAction: 'Skanerlash',
      copied: 'Maʼlumot nusxalandi',
      noData: '—',
    }
    : {
      tabs: { read: 'Читать', write: 'Записать', verify: 'Проверить', batch: 'Batch', lock: 'Защита' },
      readTapToScan: 'Нажми для сканирования',
      readBringTag: 'Поднеси метку...',
      readTagRead: 'Метка прочитана',
      readAgain: 'Ещё раз',
      open: 'Открыть',
      copy: 'Копировать',
      payloadType: 'Формат',
      payloadValue: 'Данные',
      letters: 'Буквы',
      digits: 'Цифры',
      writeMode: 'Режим записи',
      slugMode: 'UNQX slug',
      otherMode: 'Другое',
      templates: 'Готовые шаблоны',
      templatePickerTitle: 'Выберите шаблон',
      otherValue: 'Значение',
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
      verifyPayloadType: 'Payload',
      verifyData: 'Данные',
      secured: 'С защитой',
      notSecured: 'Без защиты',
      verifyButton: 'Проверить метку',
      verifyAgain: 'Проверить ещё',
      batchInfo: 'Batch-режим: пиши один payload на множество меток подряд.',
      tagsWritten: 'Записано меток',
      bringTag: 'Поднеси метку',
      batchTagWritten: 'Метка #%1 записана',
      batchNext: 'Следующая #%1',
      batchStart: 'Начать запись',
      batchFinish: 'Завершить · %1 шт.',
      lockWarning: 'Внимание',
      lockInfo: 'Защита паролем блокирует перезапись. Если забудешь, метку нельзя разблокировать.',
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
      copied: 'Данные скопированы',
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
    queryKey: queryKeys.nfcLocalHistory,
    queryFn: readLocalNfcHistory,
  });

  const history = React.useMemo(() => historyQuery.data?.items ?? [], [historyQuery.data]);

  React.useEffect(() => {
    const prev = prevStateRef.current;

    if ((state === 'success' || state === 'written' || state === 'verified' || state === 'locked') && prev !== state) {
      void markPushTrigger('nfc').catch(() => undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: queryKeys.nfcLocalHistory });

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
  }, [incrementSuccess, maybeAskReview, queryClient, state]);

  React.useEffect(() => {
    if (!error) {
      return;
    }

    const readableError = error === NFC_PROTECTED_TAG_ERROR
      ? (isUz ? "Teg himoyalangan. Unga yozib bo'lmaydi." : 'Метка защищена. Запись невозможна.')
      : error;

    toast.error(MESSAGES.toast.nfcWriteError, readableError);
  }, [error, isUz]);

  const switchTab = React.useCallback(
    (tab: NfcTab) => {
      setActiveTab(tab);
      reset();
      if (tab !== 'batch') {
        batchPendingRef.current = false;
        setBatchCount(0);
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
    if (!currentPayload) {
      return;
    }

    void writePayload(currentPayload);
  }, [currentPayload, writePayload]);

  const handleVerify = React.useCallback(() => {
    void verify();
  }, [verify]);

  const handleNextBatch = React.useCallback(() => {
    if (!currentPayload) {
      return;
    }

    batchPendingRef.current = true;
    void writePayload(currentPayload);
  }, [currentPayload, writePayload]);

  const handleLock = React.useCallback(() => {
    if (lockPassword.length < 4) {
      return;
    }

    void lock(lockPassword);
  }, [lock, lockPassword]);

  const handleOpen = React.useCallback(() => {
    if (tag?.url) {
      void Linking.openURL(tag.url);
    }
  }, [tag?.url]);

  const handleCopyPayload = React.useCallback(() => {
    if (!tag?.payloadValue) {
      return;
    }

    void Clipboard.setStringAsync(tag.payloadValue)
      .then(() => {
        toast.success(nfcText.copied);
      })
      .catch(() => undefined);
  }, [nfcText.copied, tag?.payloadValue]);

  const writePending = state === 'writing';
  const lockPending = state === 'locking';

  const renderPayloadComposer = (disabled: boolean): React.JSX.Element => (
    <View style={styles.composer}>
      <View style={styles.inputCol}>
        <Label color={tokens.textMuted}>{nfcText.writeMode}</Label>
        <View style={[styles.segmentedWrap, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          {([
            ['slug', nfcText.slugMode],
            ['other', nfcText.otherMode],
          ] as const).map(([mode, label]) => {
            const active = writeMode === mode;
            return (
              <AnimatedPressable
                key={mode}
                style={[
                  styles.segmentedBtn,
                  {
                    backgroundColor: active ? tokens.accent : 'transparent',
                    borderColor: active ? tokens.accent : 'transparent',
                  },
                ]}
                onPress={() => setWriteMode(mode)}
                disabled={disabled}
              >
                <Text style={[styles.segmentedText, { color: active ? tokens.accentText : tokens.text }]}>{label}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {writeMode === 'slug' ? (
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
              editable={!disabled}
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
              editable={!disabled}
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
      ) : (
        <>
          <View style={styles.inputCol}>
            <Label color={tokens.textMuted}>{nfcText.templates}</Label>
            <Pressable
              style={[styles.selectTrigger, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}
              onPress={() => setTemplatePickerVisible(true)}
              disabled={disabled}
            >
              <Text style={[styles.selectText, { color: tokens.text }]}>{selectedTemplateMeta.label}</Text>
              <ChevronDown size={18} strokeWidth={1.6} color={tokens.textMuted} />
            </Pressable>
          </View>

          <View style={styles.inputCol}>
            <Label color={tokens.textMuted}>{nfcText.otherValue}</Label>
            <TextInput
              value={otherValue}
              onChangeText={setOtherValue}
              placeholder={selectedTemplateMeta.placeholder}
              placeholderTextColor={tokens.textMuted}
              editable={!disabled}
              keyboardType={selectedTemplateMeta.keyboardType}
              autoCapitalize='none'
              autoCorrect={false}
              multiline={selectedTemplate === 'plain_text'}
              textAlignVertical={selectedTemplate === 'plain_text' ? 'top' : 'center'}
              style={[
                styles.otherInput,
                selectedTemplate === 'plain_text' ? styles.otherInputMultiline : null,
                {
                  backgroundColor: tokens.inputBg,
                  borderColor: otherValue.trim() ? tokens.borderStrong : tokens.border,
                  color: tokens.text,
                },
              ]}
            />
          </View>
        </>
      )}

    </View>
  );

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
                  <Text style={[styles.resultAvatarText, { color: tokens.accent }]}>N</Text>
                </View>
                <View>
                  <Text style={[styles.resultName, { color: tokens.text }]}>{MESSAGES.ui.screens.nfc}</Text>
                </View>
              </View>
              <Row
                label={nfcText.payloadType}
                value={getPayloadKindLabel(tag?.payloadKind, isUz)}
                textColor={tokens.text}
                mutedColor={tokens.textMuted}
                borderColor={tokens.border}
              />
              <Row
                label={nfcText.payloadValue}
                value={scannedPreview || nfcText.noData}
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

          {tag?.payloadKind === 'url' && tag.url ? (
            <AnimatedPressable style={[styles.primaryBtn, styles.flexBtn, { backgroundColor: tokens.accent, borderColor: tokens.accent }]} onPress={handleOpen}>
              <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>{nfcText.open}</Text>
            </AnimatedPressable>
          ) : null}

          {tag?.payloadKind === 'text' && tag.payloadValue ? (
            <AnimatedPressable style={[styles.primaryBtn, styles.flexBtn, { backgroundColor: tokens.accent, borderColor: tokens.accent }]} onPress={handleCopyPayload}>
              <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>{nfcText.copy}</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const renderWrite = (): React.JSX.Element => (
    <View style={styles.tabSection}>
      {renderPayloadComposer(writePending)}

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
              <Text style={[styles.writeDoneSlugText, { color: tokens.text }]}>
                {tag?.displayValue ?? currentPayload?.displayValue ?? nfcText.noData}
              </Text>
            </View>
          </View>
        ) : null}
      </ScanArea>

      {(state === 'idle' || state === 'writing') ? (
        <AnimatedPressable
          style={[
            styles.primaryBtn,
            {
              backgroundColor: payloadReady ? tokens.accent : tokens.surface,
              borderColor: payloadReady ? tokens.accent : tokens.border,
              opacity: payloadReady && !writePending && !nfcUnavailable ? 1 : 0.5,
            },
          ]}
          disabled={!payloadReady || writePending || nfcUnavailable}
          onPress={handleWrite}
        >
          {writePending ? (
            <ActivityIndicator color={tokens.accentText} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: payloadReady ? tokens.accentText : tokens.text }]}>{nfcText.writeToTag}</Text>
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
              [nfcText.verifyPayloadType, getPayloadKindLabel(tag?.payloadKind, isUz)],
              [nfcText.verifyData, tag?.displayValue ?? tag?.payloadValue ?? nfcText.noData],
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

      {renderPayloadComposer(writePending)}

      <View style={[styles.batchCounter, { borderColor: `${tokens.accent}30`, backgroundColor: `${tokens.accent}10` }]}>
        <Text style={[styles.batchCount, { color: tokens.accent }]}>{batchCount}</Text>
        <View style={styles.batchMeta}>
          <Text style={[styles.batchTitle, { color: tokens.text }]}>{nfcText.tagsWritten}</Text>
          <Text style={[styles.batchSub, { color: tokens.textMuted }]} numberOfLines={1}>
            {currentPayload?.displayValue ?? nfcText.noData}
          </Text>
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
              backgroundColor: payloadReady ? tokens.accent : tokens.surface,
              borderColor: payloadReady ? tokens.accent : tokens.border,
              opacity: payloadReady && !writePending && !nfcUnavailable ? 1 : 0.5,
            },
          ]}
          disabled={!payloadReady || writePending || nfcUnavailable}
          onPress={handleNextBatch}
        >
          {writePending ? (
            <ActivityIndicator color={tokens.accentText} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: payloadReady ? tokens.accentText : tokens.text }]}>
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
      <AppShell title={MESSAGES.ui.screens.nfc} tokens={tokens} allowNotifications={signedIn}>
        <ScreenTransition>
          <Modal
            visible={templatePickerVisible}
            transparent
            animationType='fade'
            onRequestClose={() => setTemplatePickerVisible(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setTemplatePickerVisible(false)}>
              <Pressable
                style={[styles.modalCard, { backgroundColor: tokens.bg, borderColor: tokens.border }]}
                onPress={(event) => event.stopPropagation()}
              >
                <Text style={[styles.modalTitle, { color: tokens.text }]}>{nfcText.templatePickerTitle}</Text>
                <ScrollView
                  style={styles.templateList}
                  contentContainerStyle={styles.templateListContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps='handled'
                >
                  {templateOptions.map((template) => {
                    const selected = selectedTemplate === template.id;
                    return (
                      <Pressable
                        key={template.id}
                        onPress={() => {
                          setSelectedTemplate(template.id);
                          setTemplatePickerVisible(false);
                        }}
                        style={[
                          styles.templateOption,
                          {
                            borderColor: selected ? tokens.accent : tokens.border,
                            backgroundColor: selected ? `${tokens.accent}14` : tokens.surface,
                          },
                        ]}
                      >
                        <Text style={[styles.templateOptionText, { color: selected ? tokens.accent : tokens.text }]}>
                          {template.label}
                        </Text>
                        {selected ? <Text style={[styles.templateOptionCheck, { color: tokens.accent }]}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>

          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={historyQuery.isRefetching} onRefresh={() => void historyQuery.refetch()} tintColor={tokens.accent} colors={[tokens.accent]} />}
          >
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
                        <View style={styles.historySkeletonText}>
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

              {history.map((item, index, arr) => {
                const preview = getHistoryPreview(item) || nfcText.noData;
                return (
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
                          {getHistoryTypeMark(item.type)}
                        </Text>
                      </View>

                      <View style={styles.historyMeta}>
                        <Text style={[styles.historySlug, { color: tokens.text }]} numberOfLines={1}>{preview}</Text>
                        <Text style={[styles.historyTime, { color: tokens.textMuted }]}>
                          {getPayloadKindLabel(item.payloadKind, isUz)} · {formatHistoryTime(item.timestamp, isUz)}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.historyChevron, { color: tokens.textMuted }]}>›</Text>
                  </View>
                );
              })}
            </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  tabWrap: {
    flexShrink: 1,
  },
  tabBtn: {
    minHeight: 44,
    paddingHorizontal: 8,
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
  composer: {
    gap: 10,
  },
  segmentedWrap: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  segmentedBtn: {
    minWidth: 156,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentedText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  selectTrigger: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    maxHeight: '68%',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  templateList: {
    flexGrow: 0,
  },
  templateListContent: {
    gap: 8,
    paddingBottom: 6,
  },
  templateOption: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  templateOptionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  templateOptionCheck: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
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
  otherInput: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  otherInputMultiline: {
    minHeight: 108,
    paddingTop: 14,
    paddingBottom: 14,
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
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
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
  batchMeta: {
    flex: 1,
  },
  batchTitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  batchSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
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
    flex: 1,
  },
  historySkeletonText: {
    gap: 5,
    width: 160,
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
  historyMeta: {
    flex: 1,
  },
  historySlug: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
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
