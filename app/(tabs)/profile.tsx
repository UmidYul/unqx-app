import React from 'react';
import { Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { normalizeButtonIconKey } from '@/components/profile/buttonIcons';
import { ShareSheet } from '@/components/ShareSheet';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCircle } from '@/components/ui/skeleton';
import { Label, Pill } from '@/components/ui/shared';
import { useBiometrics } from '@/hooks/useBiometrics';
import { MESSAGES } from '@/constants/messages';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
import { useStoreReview } from '@/hooks/useStoreReview';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { resolveAssetUrl } from '@/lib/assetUrl';
import { ApiError, nfcApi, apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';
import { storageGetItem, storageSetItem } from '@/lib/secureStorage';
import {
  createWristbandOrderLike,
  fetchWristbandOrdersLike,
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
import { toUserErrorMessage } from '@/utils/errorMessages';
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
  bio: '',
  hashtag: '',
  address: '',
  postcode: '',
  extraPhone: '',
  tags: [],
  customColor: '#111111',
  showBranding: true,
  phone: '',
  telegram: '',
  email: '',
  slug: 'UNQ001',
  avatarUrl: undefined,
  theme: 'default_dark',
  buttons: [
    { icon: 'phone', label: 'Позвонить', url: '' },
    { icon: 'telegram', label: 'Telegram', url: '' },
    { icon: 'website', label: 'Сайт', url: '' },
  ],
};

const BIOMETRIC_TIMEOUT_OPTIONS_MS = [0, 30_000, 60_000, 5 * 60_000] as const;

function pickPrimarySlug(raw: any): string {
  const slugs = Array.isArray(raw?.slugs) ? raw.slugs : [];
  const primary = slugs.find((item: any) => item?.isPrimary);
  return String(primary?.fullSlug ?? slugs[0]?.fullSlug ?? raw?.selectedSlug ?? raw?.slug ?? raw?.username ?? DEFAULT_CARD.slug);
}

function normalizeCardTheme(rawTheme: unknown): ProfileCard['theme'] {
  const raw = String(rawTheme ?? '').trim().toLowerCase();
  if (raw === 'default_dark' || raw === 'dark' || raw === 'light' || raw === 'gradient') return 'default_dark';
  if (raw === 'arctic') return 'arctic';
  if (raw === 'linen') return 'linen';
  if (raw === 'marble') return 'marble';
  if (raw === 'forest') return 'forest';
  if (raw === 'royal_ivory' || raw === 'sage_luxe') return 'sage_luxe';
  if (raw === 'midnight_obsidian') return 'midnight_obsidian';
  if (raw === 'golden_noir') return 'golden_noir';
  if (raw === 'aurora_codex') return 'aurora_codex';
  if (raw === 'nebula_glass') return 'nebula_glass';
  return 'default_dark';
}

function parseProfileCard(raw: unknown): ProfileCard {
  const payload = raw as { user?: any; card?: any; profileCard?: any; slugs?: any[]; selectedSlug?: string };
  const sourceUser = payload?.user ?? payload;
  const card = payload?.card ?? sourceUser?.card ?? sourceUser?.profileCard ?? payload?.profileCard ?? {};

  return {
    name: card?.name ?? sourceUser?.name ?? sourceUser?.displayName ?? sourceUser?.firstName ?? DEFAULT_CARD.name,
    job: card?.job ?? card?.role ?? DEFAULT_CARD.job,
    bio: card?.bio ?? '',
    hashtag: card?.hashtag ?? '',
    address: card?.address ?? '',
    postcode: card?.postcode ?? '',
    extraPhone: card?.extraPhone ?? '',
    tags: Array.isArray(card?.tags) ? card.tags.map((item: any) => String(item)).filter(Boolean) : [],
    customColor: card?.customColor ?? '#111111',
    showBranding: typeof card?.showBranding === 'boolean' ? card.showBranding : true,
    phone: card?.phone ?? card?.extraPhone ?? sourceUser?.phone ?? '',
    telegram: card?.telegram ?? '',
    email: card?.email ?? sourceUser?.email ?? '',
    slug: pickPrimarySlug(payload),
    avatarUrl: resolveAssetUrl(card?.avatarUrl ?? card?.avatar_url ?? sourceUser?.avatarUrl ?? sourceUser?.avatar_url),
    theme: normalizeCardTheme(card?.theme),
    buttons: Array.isArray(card?.buttons)
      ? card.buttons.map((item: any) => ({
        icon: normalizeButtonIconKey(String(item?.icon ?? item?.type ?? 'other')),
        label: String(item?.label ?? item?.type ?? ''),
        url: String(item?.url ?? item?.value ?? item?.href ?? ''),
      }))
      : DEFAULT_CARD.buttons,
  };
}

function parseUserPlan(raw: unknown): 'none' | 'basic' | 'premium' | string {
  const payload = raw as { user?: any };
  const source = payload?.user ?? payload;
  const normalized = String(source?.effectivePlan ?? source?.plan ?? 'none').trim().toLowerCase();
  if (normalized === 'premium' || normalized === 'basic' || normalized === 'none') {
    return normalized;
  }
  return 'none';
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
    status: String(source?.status ?? 'pending').toLowerCase(),
    slug: source?.slug ? String(source.slug) : undefined,
    slugPrice: Number.isFinite(Number(source?.slugPrice)) ? Number(source.slugPrice) : undefined,
    requestedPlan: source?.requestedPlan ? String(source.requestedPlan) : undefined,
    planPrice: Number.isFinite(Number(source?.planPrice)) ? Number(source.planPrice) : undefined,
    bracelet: source?.bracelet === undefined ? undefined : Boolean(source.bracelet),
    statusBadge: source?.statusBadge ? String(source.statusBadge) : undefined,
    adminNote: source?.adminNote ? String(source.adminNote) : null,
    createdAt: source?.createdAt,
    estimatedAt: source?.estimatedAt,
  };
}

function parseOrders(raw: unknown): WristbandOrder[] {
  const source = (raw as { items?: unknown[] })?.items ?? raw;
  if (!Array.isArray(source)) return [];

  return source
    .map((item) => parseOrder(item))
    .filter((item) => item.id)
    .sort((a, b) => {
      const aTime = Date.parse(String(a.createdAt ?? '')) || 0;
      const bTime = Date.parse(String(b.createdAt ?? '')) || 0;
      return bTime - aTime;
    });
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
  const params = useLocalSearchParams<{ wristband?: string | string[]; showQr?: string | string[] }>();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const { incrementSuccess, maybeAskReview } = useStoreReview();
  const { tokens, theme, autoTheme, setTheme, setAutoTheme } = useThemeContext();
  const { language, setLanguage } = useLanguageContext();
  const isUz = language === 'uz';

  const [error, setError] = React.useState<string | null>(null);
  const [editorVisible, setEditorVisible] = React.useState(false);
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const [previewCard, setPreviewCard] = React.useState<ProfileCard | null>(null);
  const [shareVisible, setShareVisible] = React.useState(false);
  const [qrVisible, setQrVisible] = React.useState(false);
  const [wristbandVisible, setWristbandVisible] = React.useState(false);
  const [languageModalVisible, setLanguageModalVisible] = React.useState(false);
  const [biometricTimeoutModalVisible, setBiometricTimeoutModalVisible] = React.useState(false);

  React.useEffect(() => {
    const raw = Array.isArray(params.showQr) ? params.showQr[0] : params.showQr;
    const normalized = String(raw || '').trim().toLowerCase();
    const shouldOpenQr = normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
    if (shouldOpenQr) {
      setQrVisible(true);
    }
  }, [params.showQr]);
  const [aboutModalVisible, setAboutModalVisible] = React.useState(false);
  const [trackedOrderId, setTrackedOrderId] = React.useState<string | null>(null);
  const [autoOpenOrderId, setAutoOpenOrderId] = React.useState<string | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [biometricsEnabled, setBiometricsEnabledState] = React.useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = React.useState(false);
  const [biometricLabel, setBiometricLabel] = React.useState<string>('Face ID / отпечаток');
  const [biometricLockTimeoutMs, setBiometricLockTimeoutMs] = React.useState<number>(2000);
  const {
    isAvailable: isBiometricsAvailable,
    isEnrolled: isBiometricsEnrolled,
    authenticate: authenticateBiometrics,
    getBiometricType,
    getBiometricsEnabled,
    setBiometricsEnabled,
    getBiometricLockTimeoutMs: getBiometricLockTimeoutSetting,
    setBiometricLockTimeoutMs: setBiometricLockTimeoutSetting,
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

  const ordersQuery = useQuery({
    queryKey: queryKeys.wristbandOrders,
    queryFn: fetchWristbandOrdersLike,
  });

  const orderQuery = useQuery({
    queryKey: queryKeys.order(trackedOrderId ?? ''),
    queryFn: () => trackWristbandOrderLike(trackedOrderId as string),
    enabled: Boolean(trackedOrderId),
  });

  const card = React.useMemo(() => (meQuery.data ? parseProfileCard(meQuery.data) : null), [meQuery.data]);
  const userPlan = React.useMemo(() => parseUserPlan(meQuery.data), [meQuery.data]);
  const hasCardAccess = userPlan === 'basic' || userPlan === 'premium';
  const avatarImage = useRetryImageUri(card?.avatarUrl);
  const totalTaps = React.useMemo(() => parseTotalTaps(analyticsQuery.data), [analyticsQuery.data]);
  const wristbandStatus = React.useMemo(
    () => (wristbandQuery.data ? parseWristbandStatus(wristbandQuery.data) : null),
    [wristbandQuery.data],
  );
  const tags = React.useMemo(() => parseTags(tagsQuery.data), [tagsQuery.data]);
  const history = React.useMemo(() => parseHistory(historyQuery.data), [historyQuery.data]);
  const orders = React.useMemo(() => parseOrders(ordersQuery.data), [ordersQuery.data]);
  const order = React.useMemo<WristbandOrder | null>(() => {
    if (orderQuery.data) {
      return parseOrder(orderQuery.data);
    }
    return null;
  }, [orderQuery.data]);
  const loading = !card && (meQuery.isLoading || analyticsQuery.isLoading || tagsQuery.isLoading || historyQuery.isLoading);
  const isRefreshing = meQuery.isRefetching || wristbandQuery.isRefetching;
  const onRefresh = React.useCallback(async () => {
    await Promise.all([meQuery.refetch(), wristbandQuery.refetch(), ordersQuery.refetch()]);
  }, [meQuery, ordersQuery, wristbandQuery]);

  React.useEffect(() => {
    const wristbandParam = Array.isArray(params.wristband) ? params.wristband[0] : params.wristband;
    if (wristbandParam === '1') {
      setWristbandVisible(true);
    }
  }, [params.wristband]);

  React.useEffect(() => {
    const loadSettings = async () => {
      const [notificationsValue, available, enrolled, type, enabled, lockTimeoutMs] = await Promise.all([
        storageGetItem('unqx.settings.notifications'),
        isBiometricsAvailable(),
        isBiometricsEnrolled(),
        getBiometricType(),
        getBiometricsEnabled(),
        getBiometricLockTimeoutSetting(),
      ]);
      setNotificationsEnabled(notificationsValue !== '0');
      setBiometricsAvailable(Boolean(available && enrolled));
      setBiometricLabel(type ?? 'Face ID / отпечаток');
      setBiometricsEnabledState(Boolean(available && enrolled && enabled));
      setBiometricLockTimeoutMs(lockTimeoutMs);
    };

    void loadSettings();
  }, [getBiometricLockTimeoutSetting, getBiometricType, getBiometricsEnabled, isBiometricsAvailable, isBiometricsEnrolled]);

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
          bio: nextCard.bio ?? '',
          hashtag: nextCard.hashtag ?? '',
          address: nextCard.address ?? '',
          postcode: nextCard.postcode ?? '',
          extraPhone: nextCard.extraPhone ?? nextCard.phone ?? '',
          tags: Array.isArray(nextCard.tags) ? nextCard.tags : [],
          customColor: nextCard.customColor ?? null,
          showBranding: typeof nextCard.showBranding === 'boolean' ? nextCard.showBranding : true,
          email: nextCard.email,
          phone: nextCard.phone,
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
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'PLAN_REQUIRED') {
        const title = isUz ? 'Tarif faollashtirilmagan' : 'Тариф не активирован';
        const subtitle = isUz
          ? 'Vizitkani tahrirlash uchun avval tarif sotib oling'
          : 'Чтобы редактировать визитку, сначала купите тариф';
        setError(title);
        toast.error(title, subtitle);
        return;
      }
      if (error instanceof ApiError && error.code === 'UPGRADE_REQUIRED') {
        const title = isUz ? 'Premium kerak' : 'Нужен Премиум';
        const subtitle = isUz
          ? 'Bu funksiya Premium tarifida mavjud'
          : 'Эта функция доступна только на Премиум тарифе';
        setError(title);
        toast.error(title, subtitle);
        return;
      }

      const message = toUserErrorMessage(error, isUz ? 'Vizitkani saqlab bo‘lmadi' : 'Не удалось сохранить визитку');
      setError(message);
      toast.error(MESSAGES.toast.saveFailed, message);
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
    onError: (error) => {
      const message = toUserErrorMessage(error, isUz ? "Teg nomini o'zgartirib bo'lmadi" : 'Не удалось переименовать метку');
      setError(message);
      toast.error(MESSAGES.toast.saveFailed, message);
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

  const deleteTagMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: ({ uid }: { uid: string }) => nfcApi.deleteTag(uid),
    onMutate: async ({ uid }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.nfcTags });
      await queryClient.cancelQueries({ queryKey: queryKeys.nfcHistory });

      const previousTags = queryClient.getQueryData(queryKeys.nfcTags);
      const previousHistory = queryClient.getQueryData(queryKeys.nfcHistory);

      queryClient.setQueryData(queryKeys.nfcTags, (old: any) => ({
        ...(old ?? {}),
        items: Array.isArray(old?.items)
          ? old.items.filter((item: any) => String(item?.uid ?? '') !== uid)
          : [],
      }));

      queryClient.setQueryData(queryKeys.nfcHistory, (old: any) => ({
        ...(old ?? {}),
        items: Array.isArray(old?.items)
          ? old.items.filter((item: any) => String(item?.uid ?? '') !== uid)
          : [],
      }));

      return { previousTags, previousHistory };
    },
    onError: (error) => {
      const message = toUserErrorMessage(error, isUz ? "Tegni o'chirib bo'lmadi" : 'Не удалось удалить метку');
      setError(message);
      toast.error(MESSAGES.toast.saveFailed, message);
    },
    onSuccess: () => {
      toast.success(MESSAGES.toast.tagDeleted);
    },
    onSettled: (_data, _err, _variables, context) => {
      if (_err && context?.previousTags) {
        queryClient.setQueryData(queryKeys.nfcTags, context.previousTags);
      }
      if (_err && context?.previousHistory) {
        queryClient.setQueryData(queryKeys.nfcHistory, context.previousHistory);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.nfcTags });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nfcHistory });
    },
  });

  const createOrderMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: (payload: { address: string; quantity: number }) => createWristbandOrderLike(payload),
    onSuccess: (response) => {
      const parsed = parseOrder(response);
      if (parsed.id) {
        setTrackedOrderId(parsed.id);
        setAutoOpenOrderId(parsed.id);
      }
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.wristband });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wristbandOrders });
      toast.success(MESSAGES.toast.orderSent);
      void incrementSuccess().then(() => maybeAskReview()).catch(() => undefined);
    },
    onError: (error) => {
      const message = toUserErrorMessage(error, isUz ? "Bilaguzuk buyurtmasini yaratib bo'lmadi" : 'Не удалось создать заказ браслета');
      setError(message);
      toast.error(MESSAGES.toast.orderSendFailed, message);
    },
  });

  const handleSaveCard = React.useCallback(
    (nextCard: ProfileCard) => {
      if (!hasCardAccess) {
        const title = isUz ? 'Tarif faollashtirilmagan' : 'Тариф не активирован';
        const subtitle = isUz
          ? 'Vizitkani tahrirlash uchun avval tarif sotib oling'
          : 'Чтобы редактировать визитку, сначала купите тариф';
        setError(title);
        toast.error(title, subtitle);
        return;
      }
      if (!isOnline) {
        toast.info(MESSAGES.toast.offlineQueued);
        return;
      }
      saveCardMutation.mutate(nextCard);
    },
    [hasCardAccess, isOnline, isUz, saveCardMutation],
  );

  const handleOpenCardEditor = React.useCallback(() => {
    if (!hasCardAccess) {
      const title = isUz ? 'Tarif faollashtirilmagan' : 'Тариф не активирован';
      const subtitle = isUz
        ? 'Vizitkani tahrirlash uchun avval tarif sotib oling'
        : 'Чтобы редактировать визитку, сначала купите тариф';
      setError(title);
      toast.error(title, subtitle);
      return;
    }
    setEditorVisible(true);
  }, [hasCardAccess, isUz]);

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

  const handleDeleteTag = React.useCallback(
    (uid: string) => {
      if (!isOnline) {
        toast.info(MESSAGES.toast.offlineQueued);
        return;
      }
      deleteTagMutation.mutate({ uid });
    },
    [deleteTagMutation, isOnline],
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

  const handleOpenNotificationSettings = React.useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      toast.error(isUz ? 'Sozlamalarni ochib bo\'lmadi' : 'Не удалось открыть настройки');
    }
  }, [isUz]);

  const biometricTimeoutLabel = React.useMemo(() => {
    if (biometricLockTimeoutMs <= 0) {
      return isUz ? 'Darhol' : 'Сразу';
    }
    if (biometricLockTimeoutMs < 60_000) {
      const sec = Math.round(biometricLockTimeoutMs / 1000);
      return isUz ? `${sec} soniya` : `${sec} сек`;
    }
    const min = Math.round(biometricLockTimeoutMs / 60_000);
    return isUz ? `${min} daqiqa` : `${min} мин`;
  }, [biometricLockTimeoutMs, isUz]);

  const handleSelectBiometricTimeout = React.useCallback(async (timeoutMs: number) => {
    setBiometricLockTimeoutMs(timeoutMs);
    await setBiometricLockTimeoutSetting(timeoutMs);
    setBiometricTimeoutModalVisible(false);
  }, [setBiometricLockTimeoutSetting]);

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

  const handleOpenSupport = React.useCallback(async () => {
    const telegramAppUrl = 'tg://resolve?domain=unqx_uz';
    const telegramWebUrl = 'https://t.me/unqx_uz';

    try {
      const canOpenTelegram = await Linking.canOpenURL(telegramAppUrl);
      await Linking.openURL(canOpenTelegram ? telegramAppUrl : telegramWebUrl);
    } catch {
      toast.error(isUz ? 'Telegram ochib bo\'lmadi' : 'Не удалось открыть Telegram');
    }
  }, [isUz]);

  const handleOpenLegalUrl = React.useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(isUz ? 'Havolani ochib bo\'lmadi' : 'Не удалось открыть ссылку');
    }
  }, [isUz]);

  const filteredHistory = React.useMemo(() => {
    const uids = new Set(tags.map((tag) => tag.uid));
    return history.filter((item) => (item.uid ? uids.has(item.uid) : true));
  }, [history, tags]);

  const currentHour = getUzbekistanHour();
  const autoModeByHour = resolveThemeByHour(currentHour);
  const profileText = isUz
    ? {
      premium: 'Premium',
      basic: 'Asosiy',
      noPlan: 'Tarif tanlanmagan',
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
      systemNotifications: 'Telefon bildirishnomalari',
      systemNotificationsSub: 'Qurilma sozlamalarini ochish',
      biometricEntry: 'Kirish',
      biometricSubOn: 'Ilovani tezkor ochish',
      biometricSubOff: 'Ushbu qurilmada mavjud emas',
      biometricTimeout: 'Biometriya vaqti',
      biometricTimeoutSub: 'Fon rejimidan keyin qulf vaqti',
      biometricTimeoutModalTitle: 'Biometriya vaqtini tanlang',
      language: 'Til',
      languageValue: "O'zbekcha",
      support: "Qo'llab-quvvatlash",
      terms: 'Foydalanuvchi shartlari',
      privacy: 'Maxfiylik siyosati',
      about: 'Ilova haqida',
      languageModalTitle: 'Til tanlash',
      languageModalHint: 'Interfeys tilini tanlang',
      modalClose: 'Yopish',
      aboutModalTitle: 'UNQX haqida',
      aboutVersionLabel: 'Versiya',
      aboutDescription: 'UNQX - NFC va raqamli vizitka uchun ilova. Kontakt almashish, faoliyatni kuzatish va profildan to\'liq boshqarish imkonini beradi.',
      aboutFeaturesTitle: 'Asosiy imkoniyatlar',
      aboutFeature1: 'NFC va QR orqali tez ulashish',
      aboutFeature2: 'Taplar bo\'yicha analitika va shahar kesimi',
      aboutFeature3: 'Profil, vizitka va bilaguzuk sozlamalari',
      aboutSupportLabel: 'Yordam',
      aboutSupportValue: '@unqx_uz',
      logout: 'Akkauntdan chiqish',
      autoLight: "Yorug'",
      autoDark: "Qorong'i",
      autoPrefix: 'Avto',
    }
    : {
      premium: 'Премиум',
      basic: 'Базовый',
      noPlan: 'Тариф не выбран',
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
      systemNotifications: 'Системные уведомления',
      systemNotificationsSub: 'Открыть настройки телефона',
      biometricEntry: 'Вход',
      biometricSubOn: 'Быстрая разблокировка приложения',
      biometricSubOff: 'Недоступно на этом устройстве',
      biometricTimeout: 'Время биометрии',
      biometricTimeoutSub: 'Через сколько блокировать после фона',
      biometricTimeoutModalTitle: 'Выберите время биометрии',
      language: 'Язык',
      languageValue: 'Русский',
      support: 'Поддержка',
      terms: 'Пользовательское соглашение',
      privacy: 'Политика конфиденциальности',
      about: 'О приложении',
      languageModalTitle: 'Выбор языка',
      languageModalHint: 'Выберите язык интерфейса',
      modalClose: 'Закрыть',
      aboutModalTitle: 'О UNQX',
      aboutVersionLabel: 'Версия',
      aboutDescription: 'UNQX - приложение для NFC и цифровой визитки. Помогает быстро делиться контактами, отслеживать активность и управлять профилем в одном месте.',
      aboutFeaturesTitle: 'Ключевые возможности',
      aboutFeature1: 'Быстрый обмен через NFC и QR',
      aboutFeature2: 'Аналитика тапов и города',
      aboutFeature3: 'Настройки профиля, визитки и браслета',
      aboutSupportLabel: 'Поддержка',
      aboutSupportValue: '@unqx_uz',
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
  const getBiometricTimeoutOptionLabel = React.useCallback((timeoutMs: number): string => {
    if (timeoutMs <= 0) {
      return isUz ? 'Darhol' : 'Сразу';
    }
    if (timeoutMs < 60_000) {
      const sec = Math.round(timeoutMs / 1000);
      return isUz ? `${sec} soniya` : `${sec} сек`;
    }
    const min = Math.round(timeoutMs / 60_000);
    return isUz ? `${min} daqiqa` : `${min} мин`;
  }, [isUz]);

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
              {avatarImage.showImage && avatarImage.imageUri ? (
                <Image
                  key={`${card.avatarUrl}:${avatarImage.retryCount}`}
                  source={{ uri: avatarImage.imageUri }}
                  style={styles.avatarImage}
                  onError={avatarImage.onError}
                />
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
                  <Pill color={userPlan === 'premium' ? tokens.amber : tokens.textMuted} bg={userPlan === 'premium' ? tokens.amberBg : tokens.surface}>
                    {userPlan === 'premium' ? profileText.premium : userPlan === 'basic' ? profileText.basic : profileText.noPlan}
                  </Pill>
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
              {
                label: profileText.editCard,
                sub: hasCardAccess
                  ? profileText.editCardSub
                  : (isUz
                    ? 'Tahrirlash uchun avval tarif sotib oling'
                    : 'Для редактирования сначала купите тариф'),
                onPress: handleOpenCardEditor,
              },
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
                label={profileText.systemNotifications}
                sub={profileText.systemNotificationsSub}
                right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={() => {
                  void handleOpenNotificationSettings();
                }}
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
                label={profileText.biometricTimeout}
                sub={`${profileText.biometricTimeoutSub}: ${biometricTimeoutLabel}`}
                right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={() => setBiometricTimeoutModalVisible(true)}
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.language}
                sub={profileText.languageValue}
                right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={() => setLanguageModalVisible(true)}
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.support}
                sub='@unqx_uz'
                right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={() => {
                  void handleOpenSupport();
                }}
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.terms}
                sub='unqx.uz/terms'
                right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={() => {
                  void handleOpenLegalUrl('https://unqx.uz/terms');
                }}
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.privacy}
                sub='unqx.uz/privacy'
                right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={() => {
                  void handleOpenLegalUrl('https://unqx.uz/privacy');
                }}
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.about}
                sub='UNQX v2.0.0'
                right={<ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={() => setAboutModalVisible(true)}
                last
              />
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
          userPlan={userPlan}
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
          orders={orders}
          selectedOrderId={trackedOrderId}
          orderStatus={order}
          autoOpenOrderId={autoOpenOrderId}
          onAutoOpenHandled={() => setAutoOpenOrderId(null)}
          onRenameTag={handleRenameTag}
          onDeleteTag={handleDeleteTag}
          onCreateOrder={handleCreateOrder}
          onTrackOrder={handleTrackOrder}
          renamePending={renameTagMutation.isPending}
          deletePendingUid={deleteTagMutation.isPending ? deleteTagMutation.variables?.uid ?? null : null}
          orderPending={createOrderMutation.isPending}
        />

        <QRCodeModal visible={qrVisible} slug={card.slug} tokens={tokens} onClose={() => setQrVisible(false)} />
        <ShareSheet visible={shareVisible} slug={card.slug} name={card.name} tokens={tokens} onClose={() => setShareVisible(false)} />

        <Modal
          visible={languageModalVisible}
          transparent={false}
          animationType='fade'
          onRequestClose={() => setLanguageModalVisible(false)}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.bg }]} onPress={() => setLanguageModalVisible(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={() => undefined}>
              <Text style={[styles.modalTitle, { color: tokens.text }]}>{profileText.languageModalTitle}</Text>
              <Text style={[styles.modalHint, { color: tokens.textMuted }]}>{profileText.languageModalHint}</Text>

              {[
                { code: 'ru', label: 'Русский' },
                { code: 'uz', label: "O'zbekcha" },
              ].map((item) => {
                const selected = language === item.code;
                return (
                  <Pressable
                    key={item.code}
                    style={[styles.languageOption, { borderColor: tokens.border, backgroundColor: selected ? `${tokens.accent}14` : 'transparent' }]}
                    onPress={() => {
                      setLanguage(item.code as 'ru' | 'uz');
                      setLanguageModalVisible(false);
                    }}
                  >
                    <Text style={[styles.languageOptionLabel, { color: tokens.text }]}>{item.label}</Text>
                    <Text style={[styles.languageOptionCheck, { color: selected ? tokens.accent : tokens.textMuted }]}>{selected ? '✓' : ''}</Text>
                  </Pressable>
                );
              })}

              <Pressable style={[styles.modalCloseBtn, { borderColor: tokens.border }]} onPress={() => setLanguageModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: tokens.text }]}>{profileText.modalClose}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={biometricTimeoutModalVisible}
          transparent={false}
          animationType='fade'
          onRequestClose={() => setBiometricTimeoutModalVisible(false)}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.bg }]} onPress={() => setBiometricTimeoutModalVisible(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={() => undefined}>
              <Text style={[styles.modalTitle, { color: tokens.text }]}>{profileText.biometricTimeoutModalTitle}</Text>
              <Text style={[styles.modalHint, { color: tokens.textMuted }]}>{profileText.biometricTimeoutSub}</Text>

              {BIOMETRIC_TIMEOUT_OPTIONS_MS.map((timeoutMs) => {
                const selected = biometricLockTimeoutMs === timeoutMs;
                return (
                  <Pressable
                    key={String(timeoutMs)}
                    style={[styles.languageOption, { borderColor: tokens.border, backgroundColor: selected ? `${tokens.accent}14` : 'transparent' }]}
                    onPress={() => {
                      void handleSelectBiometricTimeout(timeoutMs);
                    }}
                  >
                    <Text style={[styles.languageOptionLabel, { color: tokens.text }]}>{getBiometricTimeoutOptionLabel(timeoutMs)}</Text>
                    <Text style={[styles.languageOptionCheck, { color: selected ? tokens.accent : tokens.textMuted }]}>{selected ? '✓' : ''}</Text>
                  </Pressable>
                );
              })}

              <Pressable style={[styles.modalCloseBtn, { borderColor: tokens.border }]} onPress={() => setBiometricTimeoutModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: tokens.text }]}>{profileText.modalClose}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={aboutModalVisible}
          transparent={false}
          animationType='fade'
          onRequestClose={() => setAboutModalVisible(false)}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.bg }]} onPress={() => setAboutModalVisible(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={() => undefined}>
              <Text style={[styles.modalTitle, { color: tokens.text }]}>{profileText.aboutModalTitle}</Text>
              <Text style={[styles.aboutText, { color: tokens.textSub }]}>{profileText.aboutDescription}</Text>

              <View style={styles.aboutMetaBox}>
                <Text style={[styles.aboutMetaLabel, { color: tokens.textMuted }]}>{profileText.aboutVersionLabel}</Text>
                <Text style={[styles.aboutMetaValue, { color: tokens.text }]}>UNQX v2.0.0</Text>
              </View>

              <Text style={[styles.aboutSectionTitle, { color: tokens.text }]}>{profileText.aboutFeaturesTitle}</Text>
              <Text style={[styles.aboutListItem, { color: tokens.textSub }]}>{`• ${profileText.aboutFeature1}`}</Text>
              <Text style={[styles.aboutListItem, { color: tokens.textSub }]}>{`• ${profileText.aboutFeature2}`}</Text>
              <Text style={[styles.aboutListItem, { color: tokens.textSub }]}>{`• ${profileText.aboutFeature3}`}</Text>

              <View style={styles.aboutMetaBox}>
                <Text style={[styles.aboutMetaLabel, { color: tokens.textMuted }]}>{profileText.aboutSupportLabel}</Text>
                <Text style={[styles.aboutMetaValue, { color: tokens.text }]}>{profileText.aboutSupportValue}</Text>
              </View>

              <Pressable style={[styles.modalCloseBtn, { borderColor: tokens.border }]} onPress={() => setAboutModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: tokens.text }]}>{profileText.modalClose}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  modalHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  languageOption: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageOptionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  languageOptionCheck: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    minWidth: 16,
    textAlign: 'center',
  },
  modalCloseBtn: {
    marginTop: 4,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  aboutSectionTitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  aboutListItem: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
  },
  aboutMetaBox: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutMetaLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  aboutMetaValue: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
