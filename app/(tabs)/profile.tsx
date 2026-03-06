import React from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, QrCode, Share2 } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { QRCodeModal } from '@/components/QRCodeModal';
import { ScreenTransition } from '@/components/ScreenTransition';
import { CardEditor } from '@/components/profile/CardEditor';
import { CardPreview } from '@/components/profile/CardPreview';
import { WristbandPage } from '@/components/profile/WristbandPage';
import { ShareSheet } from '@/components/ShareSheet';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCircle } from '@/components/ui/skeleton';
import { Label, Pill } from '@/components/ui/shared';
import { useBiometrics } from '@/hooks/useBiometrics';
import { MESSAGES } from '@/constants/messages';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useStoreReview } from '@/hooks/useStoreReview';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { resolveAssetUrl } from '@/lib/assetUrl';
import { nfcApi, apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';
import { storageGetItem, storageSetItem } from '@/lib/secureStorage';
import {
  createWristbandOrderLike,
  fetchAnalyticsDashboardLike,
  fetchProfileLike,
  saveProfileCardLike,
  trackWristbandOrderLike,
} from '@/services/mobileApi';
import { signOut } from '@/services/authSession';
import { NFCHistoryItem, ProfileCard, ThemeTokens, WristbandOrder, WristbandStatus } from '@/types';
import { useThemeContext } from '@/theme/ThemeProvider';
import { getUzbekistanHour, resolveThemeByHour } from '@/theme/tokens';
import { formatSlug } from '@/utils/avatar';
import { toast } from '@/utils/toast';

interface WristbandTag {
  uid: string;
  name: string;
  linkedSlug?: string;
  status?: string;
}

const DEFAULT_CARD: ProfileCard = {
  name: 'UNQX User',
  job: 'Digital Card Owner',
  phone: '',
  telegram: '',
  email: '',
  slug: 'UNQ001',
  avatarUrl: undefined,
  theme: 'light',
  buttons: [
    { icon: 'phone', label: 'Позвонить', url: '' },
    { icon: 'send', label: 'Telegram', url: '' },
    { icon: 'globe', label: 'Сайт', url: '' },
  ],
};

function pickPrimarySlug(raw: any): string {
  const slugs = Array.isArray(raw?.slugs) ? raw.slugs : [];
  const primary = slugs.find((item: any) => item?.isPrimary);
  return String(primary?.fullSlug ?? slugs[0]?.fullSlug ?? raw?.selectedSlug ?? raw?.slug ?? raw?.username ?? DEFAULT_CARD.slug);
}

function normalizeCardTheme(rawTheme: unknown): ProfileCard['theme'] {
  if (rawTheme === 'dark') return 'dark';
  if (rawTheme === 'gradient') return 'gradient';
  return 'light';
}

function parseProfileCard(raw: unknown): ProfileCard {
  const payload = raw as { user?: any; card?: any; profileCard?: any; slugs?: any[]; selectedSlug?: string };
  const sourceUser = payload?.user ?? payload;
  const card = payload?.card ?? sourceUser?.card ?? sourceUser?.profileCard ?? payload?.profileCard ?? {};

  return {
    name: card?.name ?? sourceUser?.name ?? sourceUser?.displayName ?? sourceUser?.firstName ?? DEFAULT_CARD.name,
    job: card?.job ?? card?.role ?? DEFAULT_CARD.job,
    phone: card?.phone ?? card?.extraPhone ?? sourceUser?.phone ?? '',
    telegram: card?.telegram ?? '',
    email: card?.email ?? sourceUser?.email ?? '',
    slug: pickPrimarySlug(payload),
    avatarUrl: resolveAssetUrl(card?.avatarUrl ?? sourceUser?.avatarUrl),
    theme: normalizeCardTheme(card?.theme),
    buttons: Array.isArray(card?.buttons)
      ? card.buttons.map((item: any) => ({
        icon: String(item?.icon ?? item?.type ?? 'phone'),
        label: String(item?.label ?? item?.type ?? ''),
        url: String(item?.url ?? item?.value ?? item?.href ?? ''),
      }))
      : DEFAULT_CARD.buttons,
  };
}

function parseTotalTaps(raw: unknown): number {
  const source = (raw as { summary?: any })?.summary ?? raw;
  return Number(source?.totalTaps ?? source?.total ?? 0) || 0;
}

function parseWristbandStatus(raw: unknown): WristbandStatus {
  const source = (raw as { status?: any })?.status ?? raw;
  return {
    status: String(source?.status ?? 'unknown'),
    model: source?.model,
    linkedSlug: source?.linkedSlug,
    orderId: source?.orderId,
  };
}

function parseTags(raw: unknown): WristbandTag[] {
  const source = (raw as { items?: unknown[]; tags?: unknown[] })?.items ?? (raw as { tags?: unknown[] })?.tags ?? raw;
  if (!Array.isArray(source)) return [];

  return source.map((item: any) => ({
    uid: String(item?.uid ?? item?.id ?? ''),
    name: String(item?.name ?? item?.label ?? 'NFC tag'),
    linkedSlug: item?.linkedSlug,
    status: item?.status,
  }));
}

function parseHistory(raw: unknown): NFCHistoryItem[] {
  const source = (raw as { items?: unknown[] })?.items ?? raw;
  if (!Array.isArray(source)) return [];

  return source.map((item: any, index) => ({
    id: String(item?.id ?? `h-${index}`),
    slug: String(item?.slug ?? 'UNQ000'),
    uid: item?.uid,
    type: item?.type === 'write' || item?.type === 'verify' || item?.type === 'lock' ? item.type : 'read',
    timestamp: String(item?.timestamp ?? item?.createdAt ?? ''),
  }));
}

function parseOrder(raw: unknown): WristbandOrder {
  const source = (raw as { order?: any })?.order ?? raw;
  return {
    id: String(source?.id ?? source?.orderId ?? ''),
    status: String(source?.status ?? 'pending'),
    createdAt: source?.createdAt,
    estimatedAt: source?.estimatedAt,
  };
}

function Toggle({ value, onPress, tokens }: { value: boolean; onPress: () => void; tokens: ThemeTokens }): React.JSX.Element {
  const progress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 280 });
  }, [progress, value]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));

  return (
    <Pressable onPress={onPress} style={[styles.toggleTrack, { backgroundColor: value ? tokens.accent : tokens.surface, borderColor: tokens.border }]}>
      <Animated.View style={[styles.toggleKnob, { backgroundColor: value ? tokens.accentText : tokens.textMuted }, knobStyle]} />
    </Pressable>
  );
}

export default function ProfilePage(): React.JSX.Element {
  const { safeReplace } = useThrottledNavigation();
  const params = useLocalSearchParams<{ wristband?: string | string[] }>();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const { incrementSuccess, maybeAskReview } = useStoreReview();
  const { tokens, theme, autoTheme, setTheme, setAutoTheme } = useThemeContext();
  const { language, toggleLanguage } = useLanguageContext();

  const [error, setError] = React.useState<string | null>(null);
  const [editorVisible, setEditorVisible] = React.useState(false);
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const [previewCard, setPreviewCard] = React.useState<ProfileCard | null>(null);
  const [shareVisible, setShareVisible] = React.useState(false);
  const [qrVisible, setQrVisible] = React.useState(false);
  const [wristbandVisible, setWristbandVisible] = React.useState(false);
  const [trackedOrderId, setTrackedOrderId] = React.useState<string | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [biometricsEnabled, setBiometricsEnabledState] = React.useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = React.useState(false);
  const [biometricLabel, setBiometricLabel] = React.useState<string>('Face ID / отпечаток');
  const {
    isAvailable: isBiometricsAvailable,
    isEnrolled: isBiometricsEnrolled,
    authenticate: authenticateBiometrics,
    getBiometricType,
    getBiometricsEnabled,
    setBiometricsEnabled,
  } = useBiometrics();

  const loadWristbandStatus = React.useCallback(async () => apiClient.get<any>('/wristband/status'), []);

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchProfileLike,
  });

  const analyticsQuery = useQuery({
    queryKey: queryKeys.analytics,
    queryFn: fetchAnalyticsDashboardLike,
  });

  const wristbandQuery = useQuery({
    queryKey: queryKeys.wristband,
    queryFn: loadWristbandStatus,
  });

  const tagsQuery = useQuery({
    queryKey: queryKeys.nfcTags,
    queryFn: nfcApi.tags,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.nfcHistory,
    queryFn: nfcApi.history,
  });

  const orderQuery = useQuery({
    queryKey: queryKeys.order(trackedOrderId ?? ''),
    queryFn: () => trackWristbandOrderLike(trackedOrderId as string),
    enabled: Boolean(trackedOrderId),
  });

  const card = React.useMemo(() => (meQuery.data ? parseProfileCard(meQuery.data) : null), [meQuery.data]);
  const totalTaps = React.useMemo(() => parseTotalTaps(analyticsQuery.data), [analyticsQuery.data]);
  const wristbandStatus = React.useMemo(
    () => (wristbandQuery.data ? parseWristbandStatus(wristbandQuery.data) : null),
    [wristbandQuery.data],
  );
  const tags = React.useMemo(() => parseTags(tagsQuery.data), [tagsQuery.data]);
  const history = React.useMemo(() => parseHistory(historyQuery.data), [historyQuery.data]);
  const order = React.useMemo<WristbandOrder | null>(() => {
    if (orderQuery.data) {
      return parseOrder(orderQuery.data);
    }
    return null;
  }, [orderQuery.data]);
  const loading = !card && (meQuery.isLoading || analyticsQuery.isLoading || tagsQuery.isLoading || historyQuery.isLoading);
  const isRefreshing = meQuery.isRefetching || wristbandQuery.isRefetching;
  const onRefresh = React.useCallback(async () => {
    await Promise.all([meQuery.refetch(), wristbandQuery.refetch()]);
  }, [meQuery, wristbandQuery]);

  React.useEffect(() => {
    const wristbandParam = Array.isArray(params.wristband) ? params.wristband[0] : params.wristband;
    if (wristbandParam === '1') {
      setWristbandVisible(true);
    }
  }, [params.wristband]);

  React.useEffect(() => {
    const loadSettings = async () => {
      const [notificationsValue, available, enrolled, type, enabled] = await Promise.all([
        storageGetItem('unqx.settings.notifications'),
        isBiometricsAvailable(),
        isBiometricsEnrolled(),
        getBiometricType(),
        getBiometricsEnabled(),
      ]);
      setNotificationsEnabled(notificationsValue !== '0');
      setBiometricsAvailable(Boolean(available && enrolled));
      setBiometricLabel(type ?? 'Face ID / отпечаток');
      setBiometricsEnabledState(Boolean(available && enrolled && enabled));
    };

    void loadSettings();
  }, [getBiometricType, getBiometricsEnabled, isBiometricsAvailable, isBiometricsEnrolled]);

  const saveCardMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: (nextCard: ProfileCard) => saveProfileCardLike(nextCard),
    onMutate: async (nextCard) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.me });
      const previous = queryClient.getQueryData(queryKeys.me);
      queryClient.setQueryData(queryKeys.me, (old: any) => ({
        ...(old ?? {}),
        card: {
          ...(old?.card ?? {}),
          name: nextCard.name,
          role: nextCard.job,
          email: nextCard.email,
          extraPhone: nextCard.phone,
          telegram: nextCard.telegram,
          theme: nextCard.theme,
          buttons: nextCard.buttons,
          avatarUrl: nextCard.avatarUrl,
        },
        user: {
          ...(old?.user ?? old ?? {}),
          name: nextCard.name,
          email: nextCard.email,
          card: {
            ...(old?.user?.card ?? {}),
            name: nextCard.name,
          },
        },
      }));
      return { previous };
    },
    onError: () => {
      setError('Не удалось сохранить визитку');
      toast.error(MESSAGES.toast.saveFailed, MESSAGES.common.retryConnection);
    },
    onSuccess: () => {
      setEditorVisible(false);
      setError(null);
      toast.success(MESSAGES.toast.cardSaved);
      void incrementSuccess().catch(() => undefined);
    },
    onSettled: (_data, _err, _variables, context) => {
      if (_err && context?.previous) {
        queryClient.setQueryData(queryKeys.me, context.previous);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const renameTagMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: ({ uid, name }: { uid: string; name: string }) => nfcApi.renameTag(uid, name),
    onMutate: async ({ uid, name }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.nfcTags });
      const previous = queryClient.getQueryData(queryKeys.nfcTags);
      queryClient.setQueryData(queryKeys.nfcTags, (old: any) => ({
        ...(old ?? {}),
        items: Array.isArray(old?.items)
          ? old.items.map((item: any) => (item?.uid === uid ? { ...item, name } : item))
          : [],
      }));
      return { previous };
    },
    onError: () => {
      setError('Не удалось переименовать метку');
      toast.error(MESSAGES.toast.saveFailed, MESSAGES.common.retryConnection);
    },
    onSuccess: () => {
      toast.success(MESSAGES.toast.tagNameSaved);
    },
    onSettled: (_data, _err, _variables, context) => {
      if (_err && context?.previous) {
        queryClient.setQueryData(queryKeys.nfcTags, context.previous);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.nfcTags });
    },
  });

  const createOrderMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: (payload: { address: string; quantity: number }) => createWristbandOrderLike(payload),
    onSuccess: (response) => {
      const parsed = parseOrder(response);
      setTrackedOrderId(parsed.id);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.wristband });
      toast.success(MESSAGES.toast.orderSent);
      void incrementSuccess().then(() => maybeAskReview()).catch(() => undefined);
    },
    onError: () => {
      setError('Не удалось создать заказ браслета');
      toast.error(MESSAGES.toast.orderSendFailed, MESSAGES.common.retryConnection);
    },
  });

  const handleSaveCard = React.useCallback(
    (nextCard: ProfileCard) => {
      if (!isOnline) {
        toast.info(MESSAGES.toast.offlineQueued);
        return;
      }
      saveCardMutation.mutate(nextCard);
    },
    [isOnline, saveCardMutation],
  );

  const handleRenameTag = React.useCallback(
    (uid: string, name: string) => {
      if (!isOnline) {
        toast.info(MESSAGES.toast.offlineQueued);
        return;
      }
      renameTagMutation.mutate({ uid, name });
    },
    [isOnline, renameTagMutation],
  );

  const handleCreateOrder = React.useCallback(
    (payload: { address: string; quantity: number }) => {
      if (!isOnline) {
        toast.info(MESSAGES.toast.offlineQueued);
        return;
      }
      createOrderMutation.mutate(payload);
    },
    [createOrderMutation, isOnline],
  );

  const handleTrackOrder = React.useCallback(
    (orderId: string) => {
      setTrackedOrderId(orderId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
    },
    [queryClient],
  );

  const toggleNotifications = React.useCallback(async () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    await storageSetItem('unqx.settings.notifications', next ? '1' : '0');
  }, [notificationsEnabled]);

  const toggleBiometrics = React.useCallback(async () => {
    if (!biometricsAvailable) {
      toast.error('Биометрия недоступна');
      return;
    }

    const next = !biometricsEnabled;
    const confirmed = await authenticateBiometrics(
      next ? 'Подтвердите включение биометрии' : 'Подтвердите отключение биометрии',
    );
    if (!confirmed) {
      toast.error(next ? 'Не удалось включить биометрию' : 'Не удалось отключить биометрию');
      return;
    }

    await setBiometricsEnabled(next);
    setBiometricsEnabledState(next);
  }, [authenticateBiometrics, biometricsAvailable, biometricsEnabled, setBiometricsEnabled]);

  const handleLogout = React.useCallback(async () => {
    try {
      await signOut();
    } finally {
      safeReplace('/login');
    }
  }, [safeReplace]);

  const filteredHistory = React.useMemo(() => {
    const uids = new Set(tags.map((tag) => tag.uid));
    return history.filter((item) => (item.uid ? uids.has(item.uid) : true));
  }, [history, tags]);

  const currentHour = getUzbekistanHour();
  const autoModeByHour = resolveThemeByHour(currentHour);
  const isUz = language === 'uz';
  const profileText = isUz
    ? {
      premium: 'Premium',
      nfcActive: '● NFC faol',
      qrTitle: 'QR-kod',
      qrSub: "Yuklab olish yoki ko'rsatish",
      shareTitle: 'Ulashish',
      shareSub: 'WhatsApp, Telegram...',
      editCard: 'Vizitkani tahrirlash',
      editCardSub: "Ism, havolalar, mavzu, tugmalar",
      wristband: 'Bilaguzuk va teglar',
      wristbandSub: 'Holat, tarix, buyurtma',
      settings: 'Sozlamalar',
      theme: 'Mavzu',
      autoTheme: 'Avto-mavzu (vaqt bo\'yicha)',
      autoThemeHours: 'Qorong\'i 20:00-08:00 (UZT)',
      notifications: 'Bildirishnomalar',
      notificationsSub: 'Taplar va faollik',
      biometricEntry: 'Kirish',
      biometricSubOn: 'Ilovani tezkor ochish',
      biometricSubOff: 'Ushbu qurilmada mavjud emas',
      language: 'Til',
      languageValue: "O'zbekcha",
      support: "Qo'llab-quvvatlash",
      about: 'Ilova haqida',
      logout: 'Akkauntdan chiqish',
      autoLight: "Yorug'",
      autoDark: "Qorong'i",
      autoPrefix: 'Avto',
    }
    : {
      premium: 'Премиум',
      nfcActive: '● NFC активен',
      qrTitle: 'QR-код',
      qrSub: 'Скачать или показать',
      shareTitle: 'Поделиться',
      shareSub: 'WhatsApp, Telegram...',
      editCard: 'Редактировать визитку',
      editCardSub: 'Имя, ссылки, тема, кнопки',
      wristband: 'Браслет и метки',
      wristbandSub: 'Статус, история, заказ',
      settings: 'Настройки',
      theme: 'Тема',
      autoTheme: 'Авто-тема (по времени)',
      autoThemeHours: 'Тёмная 20:00-08:00 (UZT)',
      notifications: 'Уведомления',
      notificationsSub: 'Тапы и активность',
      biometricEntry: 'Вход',
      biometricSubOn: 'Быстрая разблокировка приложения',
      biometricSubOff: 'Недоступно на этом устройстве',
      language: 'Язык',
      languageValue: 'Русский',
      support: 'Поддержка',
      about: 'О приложении',
      logout: 'Выйти из аккаунта',
      autoLight: 'Светлая',
      autoDark: 'Тёмная',
      autoPrefix: 'Авто',
    };
  const autoLabel = autoTheme
    ? `${profileText.autoPrefix} (${autoModeByHour === 'dark' ? profileText.autoDark : profileText.autoLight} · ${String(currentHour).padStart(2, '0')}:00 UZT)`
    : theme === 'light'
      ? profileText.autoLight
      : profileText.autoDark;

  if (loading && !card) {
    return (
      <AppShell title={MESSAGES.ui.screens.profile} tokens={tokens}>
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonHero}>
            <SkeletonCircle tokens={tokens} size={58} />
            <View style={styles.skeletonHeroBody}>
              <SkeletonBlock tokens={tokens} height={18} width='55%' />
              <SkeletonBlock tokens={tokens} height={12} width='42%' />
              <View style={styles.skeletonPills}>
                <SkeletonBlock tokens={tokens} height={20} width={76} radius={6} />
                <SkeletonBlock tokens={tokens} height={20} width={96} radius={6} />
              </View>
            </View>
          </View>
          <View style={styles.skeletonShareRow}>
            <SkeletonBlock tokens={tokens} height={112} radius={12} style={styles.skeletonShareCard} />
            <SkeletonBlock tokens={tokens} height={112} radius={12} style={styles.skeletonShareCard} />
          </View>
          <SkeletonBlock tokens={tokens} height={64} radius={12} />
          <SkeletonBlock tokens={tokens} height={64} radius={12} />
          <SkeletonBlock tokens={tokens} height={154} radius={14} />
        </View>
      </AppShell>
    );
  }

  if (!card) {
    return (
      <ErrorBoundary>
        <AppShell title={MESSAGES.ui.screens.profile} tokens={tokens}>
          <ErrorState
            tokens={tokens}
            text={MESSAGES.query.profileLoadFailed}
            onRetry={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.me });
              void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
              void queryClient.invalidateQueries({ queryKey: queryKeys.wristband });
              void queryClient.invalidateQueries({ queryKey: queryKeys.nfcTags });
              void queryClient.invalidateQueries({ queryKey: queryKeys.nfcHistory });
            }}
          />
        </AppShell>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell title={MESSAGES.ui.screens.profile} tokens={tokens}>
        <ScreenTransition>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={tokens.accent} colors={[tokens.accent]} />}
          >
            {loading ? <SkeletonBlock tokens={tokens} height={8} width={96} radius={5} /> : null}
            {error ? <Text style={[styles.error, { color: tokens.red }]}>{error}</Text> : null}

            <View style={[styles.avatarCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              {card.avatarUrl ? (
                <Image source={{ uri: card.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: tokens.inputBg, borderColor: tokens.border, borderWidth: 1 }]}>
                  <Text style={[styles.avatarText, { color: tokens.text }]}>{card.name[0] ?? 'U'}</Text>
                </View>
              )}
              <View style={styles.avatarBody}>
                <Text style={[styles.name, { color: tokens.text }]}>{card.name}</Text>
                <Text style={[styles.slug, { color: tokens.textMuted }]}>
                  unqx.uz/<Text style={styles.slugStrong}>{formatSlug(card.slug)}</Text>
                </Text>
                <View style={styles.heroPills}>
                  <Pill color={tokens.amber} bg={tokens.amberBg}>{profileText.premium}</Pill>
                  <Pill color={tokens.green} bg={tokens.greenBg}>{profileText.nfcActive}</Pill>
                </View>
              </View>
            </View>

            <View style={styles.shareGrid}>
              <AnimatedPressable
                containerStyle={styles.shareHalf}
                style={[styles.shareCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={() => setQrVisible(true)}
              >
                <QrCode size={22} strokeWidth={1.5} color={tokens.text} />
                <Text style={[styles.shareTitle, { color: tokens.text }]}>{profileText.qrTitle}</Text>
                <Text style={[styles.shareSub, { color: tokens.textMuted }]}>{profileText.qrSub}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                containerStyle={styles.shareHalf}
                style={[styles.shareCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={() => setShareVisible(true)}
              >
                <Share2 size={22} strokeWidth={1.5} color={tokens.text} />
                <Text style={[styles.shareTitle, { color: tokens.text }]}>{profileText.shareTitle}</Text>
                <Text style={[styles.shareSub, { color: tokens.textMuted }]}>{profileText.shareSub}</Text>
              </AnimatedPressable>
            </View>

            {[
              { label: profileText.editCard, sub: profileText.editCardSub, onPress: () => setEditorVisible(true) },
              { label: profileText.wristband, sub: profileText.wristbandSub, onPress: () => setWristbandVisible(true) },
            ].map((item) => (
              <AnimatedPressable key={item.label} onPress={item.onPress} style={[styles.actionRow, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: tokens.text }]}>{item.label}</Text>
                  <Text style={[styles.actionSub, { color: tokens.textMuted }]}>{item.sub}</Text>
                </View>
                <ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />
              </AnimatedPressable>
            ))}

            <Label color={tokens.textMuted}>{profileText.settings}</Label>
            <View style={[styles.settingsBox, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              <SettingsRow
                tokens={tokens}
                label={profileText.theme}
                sub={autoLabel}
                right={
                  <Toggle
                    value={theme === 'dark' && !autoTheme}
                    onPress={() => {
                      if (!autoTheme) {
                        setTheme(theme === 'light' ? 'dark' : 'light');
                      }
                    }}
                    tokens={tokens}
                  />
                }
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.autoTheme}
                sub={profileText.autoThemeHours}
                right={<Toggle value={autoTheme} onPress={() => setAutoTheme(!autoTheme)} tokens={tokens} />}
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.notifications}
                sub={profileText.notificationsSub}
                right={<Toggle value={notificationsEnabled} onPress={() => void toggleNotifications()} tokens={tokens} />}
              />
              <SettingsRow
                tokens={tokens}
                label={`${profileText.biometricEntry} ${biometricLabel}`}
                sub={biometricsAvailable ? profileText.biometricSubOn : profileText.biometricSubOff}
                right={
                  biometricsAvailable ? (
                    <Toggle value={biometricsEnabled} onPress={() => void toggleBiometrics()} tokens={tokens} />
                  ) : (
                    <Text style={[styles.settingsMuted, { color: tokens.textMuted }]}>—</Text>
                  )
                }
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.language}
                sub={profileText.languageValue}
                right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={toggleLanguage}
              />
              <SettingsRow tokens={tokens} label={profileText.support} sub='@unqx_uz' right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />} />
              <SettingsRow tokens={tokens} label={profileText.about} sub='UNQX v2.0.0' right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />} last />
            </View>

            <AnimatedPressable style={[styles.logoutBtn, { borderColor: tokens.border }]} onPress={() => void handleLogout()}>
              <Text style={[styles.logoutText, { color: tokens.red }]}>{profileText.logout}</Text>
            </AnimatedPressable>
          </ScrollView>
        </ScreenTransition>

        <CardEditor
          visible={editorVisible}
          tokens={tokens}
          card={card}
          saving={saveCardMutation.isPending}
          onClose={() => setEditorVisible(false)}
          onPreview={(nextCard) => {
            setPreviewCard(nextCard);
            setPreviewVisible(true);
          }}
          onSave={handleSaveCard}
        />

        <CardPreview
          visible={previewVisible}
          card={previewCard ?? card}
          tokens={tokens}
          onClose={() => {
            setPreviewVisible(false);
            setPreviewCard(null);
          }}
        />

        <WristbandPage
          visible={wristbandVisible}
          onClose={() => setWristbandVisible(false)}
          tokens={tokens}
          status={wristbandStatus}
          tags={tags}
          history={filteredHistory}
          loading={loading}
          orderStatus={order}
          onRenameTag={handleRenameTag}
          onCreateOrder={handleCreateOrder}
          onTrackOrder={handleTrackOrder}
          renamePending={renameTagMutation.isPending}
          orderPending={createOrderMutation.isPending}
        />

        <QRCodeModal visible={qrVisible} slug={card.slug} tokens={tokens} onClose={() => setQrVisible(false)} />
        <ShareSheet visible={shareVisible} slug={card.slug} name={card.name} tokens={tokens} onClose={() => setShareVisible(false)} />
      </AppShell>
    </ErrorBoundary>
  );
}

function SettingsRow({
  tokens,
  label,
  sub,
  right,
  last,
  onPress,
}: {
  tokens: ThemeTokens;
  label: string;
  sub: string;
  right: React.ReactNode;
  last?: boolean;
  onPress?: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[styles.settingsRow, { borderBottomColor: tokens.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}
    >
      <View>
        <Text style={[styles.settingsTitle, { color: tokens.text }]}>{label}</Text>
        <Text style={[styles.settingsSub, { color: tokens.textMuted }]}>{sub}</Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 14,
  },
  skeletonHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 94,
  },
  skeletonHeroBody: {
    flex: 1,
    gap: 8,
  },
  skeletonPills: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 6,
  },
  skeletonShareRow: {
    flexDirection: 'row',
    gap: 10,
  },
  skeletonShareCard: {
    flex: 1,
  },
  errorState: {
    marginHorizontal: 20,
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 180,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorStateTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  reloadBtn: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  error: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  meta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  avatarCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    gap: 16,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffffff',
  },
  avatarBody: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  slug: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  slugStrong: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
  heroPills: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  shareGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  shareHalf: {
    flex: 1,
  },
  shareCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  shareTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  shareSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  actionRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  actionSub: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  settingsBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  settingsRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  settingsTitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  settingsSub: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  settingsMuted: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  logoutBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logoutText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  toggleTrack: {
    width: 40,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
