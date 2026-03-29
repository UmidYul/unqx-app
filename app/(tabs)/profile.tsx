import React from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  addPrivateAccessPasswordLike,
  changePrivateAccessPasswordLike,
  deletePrivateAccessPasswordLike,
  createWristbandOrderLike,
  fetchWristbandOrdersLike,
  fetchAnalyticsDashboardLike,
  fetchPrivateAccessSettingsLike,
  fetchProfileLike,
  saveProfileCardLike,
  submitViolationReportLike,
  trackWristbandOrderLike,
} from '@/services/mobileApi';
import { signOut } from '@/services/authSession';
import {
  NFCHistoryItem,
  PrivateAccessLog,
  PrivateAccessPassword,
  ProfileCard,
  ThemeTokens,
  WristbandOrder,
  WristbandStatus,
} from '@/types';
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

type CardVisibilityStatus = 'active' | 'paused' | 'private';

interface OwnedSlugStatusItem {
  fullSlug: string;
  isPrimary: boolean;
  status: CardVisibilityStatus;
  pauseMessage: string;
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
  showBranding: true,
  phone: '',
  telegram: '',
  email: '',
  slug: '',
  avatarUrl: undefined,
  theme: 'default_dark',
  buttons: [
    { icon: 'phone', label: 'Позвонить', url: '' },
    { icon: 'telegram', label: 'Telegram', url: '' },
    { icon: 'website', label: 'Сайт', url: '' },
  ],
};

const BIOMETRIC_TIMEOUT_OPTIONS_MS = [0, 30_000, 60_000, 5 * 60_000] as const;
const VIOLATION_REPORT_TYPES = [
  'child_safety',
  'sexual_content',
  'violence',
  'fraud',
  'hate_or_harassment',
  'illegal_goods',
  'other',
] as const;
type ViolationReportType = (typeof VIOLATION_REPORT_TYPES)[number];

function normalizeOwnedSlug(value: unknown): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}\d{3}$/.test(normalized) ? normalized : '';
}

function normalizeCardVisibilityStatus(value: unknown): CardVisibilityStatus {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();

  if (raw === 'paused') return 'paused';
  if (raw === 'private') return 'private';
  if (raw === 'approved') return 'active';
  return 'active';
}

function parseOwnedSlugStatuses(raw: unknown): OwnedSlugStatusItem[] {
  const payload = raw as { slugs?: any[]; user?: any };
  const source = Array.isArray(payload?.slugs)
    ? payload.slugs
    : Array.isArray(payload?.user?.slugs)
      ? payload.user.slugs
      : [];

  return source
    .map((item: any): OwnedSlugStatusItem | null => {
      const normalizedSlug = normalizeOwnedSlug(item?.fullSlug ?? item?.slug);
      if (!normalizedSlug) {
        return null;
      }

      return {
        fullSlug: normalizedSlug,
        isPrimary: Boolean(item?.isPrimary),
        status: normalizeCardVisibilityStatus(item?.status),
        pauseMessage: String(item?.pauseMessage ?? ''),
      };
    })
    .filter((item: OwnedSlugStatusItem | null): item is OwnedSlugStatusItem => item !== null);
}

function pickPrimarySlug(raw: any): string {
  const slugs = Array.isArray(raw?.slugs) ? raw.slugs : [];
  const primary = slugs.find((item: any) => item?.isPrimary);
  const sourceUser = raw?.user ?? {};
  const candidates = [
    primary?.fullSlug,
    primary?.slug,
    slugs[0]?.fullSlug,
    slugs[0]?.slug,
    raw?.selectedSlug,
    sourceUser?.selectedSlug,
  ];

  for (const value of candidates) {
    const normalized = normalizeOwnedSlug(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
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
  if (raw === 'velours') return 'velours';
  return 'default_dark';
}

function parseProfileCard(raw: unknown): ProfileCard {
  const payload = raw as { user?: any; card?: any; profileCard?: any; slugs?: any[]; selectedSlug?: string };
  const sourceUser = payload?.user ?? payload;
  const card = payload?.card ?? sourceUser?.card ?? sourceUser?.profileCard ?? payload?.profileCard ?? {};
  // Проверяем наличие валидного id или slug
  const userId = sourceUser?.id;
  const slug = pickPrimarySlug(payload);
  if (!userId && !slug) {
    return null;
  }
  return {
    name: card?.name ?? sourceUser?.name ?? sourceUser?.displayName ?? sourceUser?.firstName ?? DEFAULT_CARD.name,
    job: card?.job ?? card?.role ?? DEFAULT_CARD.job,
    bio: card?.bio ?? '',
    hashtag: card?.hashtag ?? '',
    address: card?.address ?? '',
    postcode: card?.postcode ?? '',
    extraPhone: card?.extraPhone ?? '',
    tags: Array.isArray(card?.tags) ? card.tags.map((item: any) => String(item)).filter(Boolean) : [],
    showBranding: typeof card?.showBranding === 'boolean' ? card.showBranding : true,
    phone: card?.phone ?? card?.extraPhone ?? sourceUser?.phone ?? '',
    telegram: card?.telegram ?? '',
    email: card?.email ?? sourceUser?.email ?? '',
    slug,
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
    slug: String(item?.slug ?? ''),
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

function formatDateTimeShort(value: string | null | undefined, isUz: boolean): string {
  const parsed = Date.parse(String(value ?? ''));
  if (!Number.isFinite(parsed)) {
    return isUz ? '—' : '—';
  }
  return new Date(parsed).toLocaleString(isUz ? 'uz-UZ' : 'ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
  const [cardVisibilityModalVisible, setCardVisibilityModalVisible] = React.useState(false);
  const [wristbandVisible, setWristbandVisible] = React.useState(false);
  const [languageModalVisible, setLanguageModalVisible] = React.useState(false);
  const [biometricTimeoutModalVisible, setBiometricTimeoutModalVisible] = React.useState(false);
  const [privateAccessModalVisible, setPrivateAccessModalVisible] = React.useState(false);
  const [violationModalVisible, setViolationModalVisible] = React.useState(false);
  const [violationType, setViolationType] = React.useState<ViolationReportType>('child_safety');
  const [violationMessage, setViolationMessage] = React.useState('');
  const [privatePasswordLabelInput, setPrivatePasswordLabelInput] = React.useState('');
  const [privatePasswordValueInput, setPrivatePasswordValueInput] = React.useState('');
  const [changePasswordId, setChangePasswordId] = React.useState<string | null>(null);
  const [changeOldPassword, setChangeOldPassword] = React.useState('');
  const [changeNewPassword, setChangeNewPassword] = React.useState('');

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
  const ownedSlugStatuses = React.useMemo(() => parseOwnedSlugStatuses(meQuery.data), [meQuery.data]);
  const userPlan = React.useMemo(() => parseUserPlan(meQuery.data), [meQuery.data]);
  const hasOwnedSlug = React.useMemo(() => Boolean(card?.slug && normalizeOwnedSlug(card.slug)), [card?.slug]);
  const hasCardAccess = userPlan === 'basic' || userPlan === 'premium';
  const canUseCardFeatures = hasCardAccess && hasOwnedSlug;
  const privateAccessQuery = useQuery({
    queryKey: ['profile-private-access'],
    queryFn: fetchPrivateAccessSettingsLike,
    enabled: canUseCardFeatures,
    retry: false,
  });
  const currentCardVisibility = React.useMemo<CardVisibilityStatus>(() => {
    if (!ownedSlugStatuses.length) {
      return 'active';
    }
    const primary = ownedSlugStatuses.find((item) => item.isPrimary) ?? ownedSlugStatuses[0];
    return normalizeCardVisibilityStatus(primary?.status);
  }, [ownedSlugStatuses]);
  const hasMixedCardVisibility = React.useMemo(() => {
    const statuses = new Set(ownedSlugStatuses.map((item) => normalizeCardVisibilityStatus(item.status)));
    return statuses.size > 1;
  }, [ownedSlugStatuses]);
  const avatarImage = useRetryImageUri(card?.avatarUrl);
  const totalTaps = React.useMemo(() => parseTotalTaps(analyticsQuery.data), [analyticsQuery.data]);
  const wristbandStatus = React.useMemo(
    () => (wristbandQuery.data ? parseWristbandStatus(wristbandQuery.data) : null),
    [wristbandQuery.data],
  );
  const tags = React.useMemo(() => parseTags(tagsQuery.data), [tagsQuery.data]);
  const history = React.useMemo(() => parseHistory(historyQuery.data), [historyQuery.data]);
  const orders = React.useMemo(() => parseOrders(ordersQuery.data), [ordersQuery.data]);
  const privatePasswords = React.useMemo<PrivateAccessPassword[]>(
    () => (Array.isArray(privateAccessQuery.data?.passwords) ? privateAccessQuery.data.passwords : []),
    [privateAccessQuery.data?.passwords],
  );
  const privateAccessLogs = React.useMemo<PrivateAccessLog[]>(
    () => (Array.isArray(privateAccessQuery.data?.logs) ? privateAccessQuery.data.logs : []),
    [privateAccessQuery.data?.logs],
  );
  const privatePasswordMinLength = Number(privateAccessQuery.data?.minLength ?? 4) || 4;
  const privatePasswordLimit = Number(privateAccessQuery.data?.limit ?? 10) || 10;
  const order = React.useMemo<WristbandOrder | null>(() => {
    if (orderQuery.data) {
      return parseOrder(orderQuery.data);
    }
    return null;
  }, [orderQuery.data]);
  const loading = !card && (meQuery.isLoading || analyticsQuery.isLoading || tagsQuery.isLoading || historyQuery.isLoading);
  const isRefreshing = meQuery.isRefetching || wristbandQuery.isRefetching;

  React.useEffect(() => {
    if (!canUseCardFeatures) {
      if (qrVisible) setQrVisible(false);
      if (shareVisible) setShareVisible(false);
      if (privateAccessModalVisible) setPrivateAccessModalVisible(false);
    }
  }, [canUseCardFeatures, privateAccessModalVisible, qrVisible, shareVisible]);

  React.useEffect(() => {
    if (privateAccessModalVisible) {
      return;
    }
    setPrivatePasswordLabelInput('');
    setPrivatePasswordValueInput('');
    setChangePasswordId(null);
    setChangeOldPassword('');
    setChangeNewPassword('');
  }, [privateAccessModalVisible]);

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      meQuery.refetch(),
      wristbandQuery.refetch(),
      ordersQuery.refetch(),
      canUseCardFeatures ? privateAccessQuery.refetch() : Promise.resolve(null),
    ]);
  }, [canUseCardFeatures, meQuery, ordersQuery, privateAccessQuery, wristbandQuery]);

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

  const addPrivatePasswordMutation = useMutation({
    networkMode: 'online',
    mutationFn: (payload: { label?: string; password: string }) => addPrivateAccessPasswordLike(payload),
    onSuccess: async () => {
      setPrivatePasswordLabelInput('');
      setPrivatePasswordValueInput('');
      setError(null);
      toast.success(isUz ? 'Parol qo‘shildi' : 'Пароль добавлен');
      await privateAccessQuery.refetch();
    },
    onError: (error) => {
      const message = toUserErrorMessage(error, isUz ? 'Parol qo‘shib bo‘lmadi' : 'Не удалось добавить пароль');
      setError(message);
      toast.error(MESSAGES.toast.saveFailed, message);
    },
  });

  const changePrivatePasswordMutation = useMutation({
    networkMode: 'online',
    mutationFn: (payload: { id: string; oldPassword: string; newPassword: string }) => changePrivateAccessPasswordLike(payload),
    onSuccess: async () => {
      setChangePasswordId(null);
      setChangeOldPassword('');
      setChangeNewPassword('');
      setError(null);
      toast.success(isUz ? 'Parol yangilandi' : 'Пароль обновлён');
      await privateAccessQuery.refetch();
    },
    onError: (error) => {
      const message = toUserErrorMessage(error, isUz ? 'Parolni yangilab bo‘lmadi' : 'Не удалось обновить пароль');
      setError(message);
      toast.error(MESSAGES.toast.saveFailed, message);
    },
  });

  const deletePrivatePasswordMutation = useMutation({
    networkMode: 'online',
    mutationFn: (id: string) => deletePrivateAccessPasswordLike(id),
    onSuccess: async () => {
      if (changePasswordId) {
        setChangePasswordId(null);
        setChangeOldPassword('');
        setChangeNewPassword('');
      }
      setError(null);
      toast.success(isUz ? 'Parol o‘chirildi' : 'Пароль удалён');
      await privateAccessQuery.refetch();
    },
    onError: (error) => {
      const message = toUserErrorMessage(error, isUz ? 'Parolni o‘chirib bo‘lmadi' : 'Не удалось удалить пароль');
      setError(message);
      toast.error(MESSAGES.toast.saveFailed, message);
    },
  });

  const updateCardVisibilityMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async (nextStatus: CardVisibilityStatus) => {
      if (!ownedSlugStatuses.length) {
        throw new ApiError('Slug is required', 400, 'SLUG_REQUIRED');
      }

      try {
        await apiClient.patch('/profile/card/status', { status: nextStatus });
      } catch (error) {
        const isEndpointMissing = error instanceof ApiError && (error.status === 404 || error.status === 405);
        if (!isEndpointMissing) {
          throw error;
        }

        const uniqueSlugs = Array.from(new Set(ownedSlugStatuses.map((item) => item.fullSlug).filter(Boolean)));
        if (!uniqueSlugs.length) {
          throw new ApiError('Slug is required', 400, 'SLUG_REQUIRED');
        }
        await Promise.all(
          uniqueSlugs.map((slug) =>
            apiClient.patch(`/profile/slugs/${encodeURIComponent(slug)}/status`, { status: nextStatus })),
        );
      }

      return { nextStatus };
    },
    onMutate: async (nextStatus) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.me });
      const previous = queryClient.getQueryData(queryKeys.me);

      queryClient.setQueryData(queryKeys.me, (old: any) => {
        if (!old || typeof old !== 'object') {
          return old;
        }

        const patchSlugs = (slugs: unknown): unknown => {
          if (!Array.isArray(slugs)) {
            return slugs;
          }
          return slugs.map((item: any) => ({
            ...item,
            status: nextStatus,
          }));
        };

        return {
          ...old,
          slugs: patchSlugs(old?.slugs),
          user: old?.user
            ? {
              ...old.user,
              slugs: patchSlugs(old.user.slugs),
            }
            : old?.user,
        };
      });

      return { previous };
    },
    onSuccess: () => {
      setCardVisibilityModalVisible(false);
      setError(null);
      toast.success(isUz ? 'Vizitka holati yangilandi' : 'Статус визитки обновлён');
    },
    onError: (error, _nextStatus, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.me, context.previous);
      }

      if (error instanceof ApiError && error.code === 'PLAN_REQUIRED') {
        notifyPlanAndSlugRequired();
        return;
      }

      const message = toUserErrorMessage(error, isUz ? 'Holatni yangilab bo‘lmadi' : 'Не удалось обновить статус');
      setError(message);
      toast.error(MESSAGES.toast.saveFailed, message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.homeSummary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.homeRecent });
    },
  });

  const submitViolationReportMutation = useMutation({
    networkMode: 'online',
    mutationFn: (payload: { type: ViolationReportType; message: string }) => submitViolationReportLike(payload),
    onSuccess: () => {
      setViolationModalVisible(false);
      setViolationType('child_safety');
      setViolationMessage('');
      setError(null);
      toast.success(isUz ? 'Xabaringiz yuborildi' : 'Сообщение отправлено');
    },
    onError: (error) => {
      const message = toUserErrorMessage(error, isUz ? 'Xabar yuborib bo‘lmadi' : 'Не удалось отправить сообщение');
      setError(message);
      toast.error(MESSAGES.toast.saveFailed, message);
    },
  });

  const openPricingPage = React.useCallback(async () => {
    try {
      await Linking.openURL('https://unqx.uz/#pricing');
    } catch {
      toast.error(isUz ? 'Havolani ochib bo\'lmadi' : 'Не удалось открыть ссылку');
    }
  }, [isUz]);

  const notifyPlanAndSlugRequired = React.useCallback(() => {
    const title = isUz ? 'SLUG va tarif kerak' : 'Нужны slug и тариф';
    const subtitle = isUz
      ? 'Vizitka, QR va ulashish uchun avval SLUG egallab tarifni faollashtiring'
      : 'Чтобы пользоваться визиткой, QR и шарингом, сначала купите slug и активируйте тариф';
    setError(title);
    toast.error(title, subtitle);
    void openPricingPage();
  }, [isUz, openPricingPage]);

  const handleSaveCard = React.useCallback(
    (nextCard: ProfileCard) => {
      if (!canUseCardFeatures) {
        notifyPlanAndSlugRequired();
        return;
      }
      if (!isOnline) {
        toast.info(MESSAGES.toast.offlineQueued);
        return;
      }
      saveCardMutation.mutate(nextCard);
    },
    [canUseCardFeatures, isOnline, notifyPlanAndSlugRequired, saveCardMutation],
  );

  const handleOpenCardEditor = React.useCallback(() => {
    if (!canUseCardFeatures) {
      notifyPlanAndSlugRequired();
      return;
    }
    setEditorVisible(true);
  }, [canUseCardFeatures, notifyPlanAndSlugRequired]);

  const handleOpenCardVisibility = React.useCallback(() => {
    if (!canUseCardFeatures) {
      notifyPlanAndSlugRequired();
      return;
    }

    if (!ownedSlugStatuses.length) {
      const message = isUz ? 'Slug topilmadi' : 'Slug не найден';
      setError(message);
      toast.error(message);
      return;
    }

    setCardVisibilityModalVisible(true);
  }, [canUseCardFeatures, isUz, notifyPlanAndSlugRequired, ownedSlugStatuses.length]);

  const handleOpenPrivateAccess = React.useCallback(() => {
    if (!canUseCardFeatures) {
      notifyPlanAndSlugRequired();
      return;
    }
    setPrivateAccessModalVisible(true);
    if (!privateAccessQuery.data && !privateAccessQuery.isFetching) {
      void privateAccessQuery.refetch();
    }
  }, [canUseCardFeatures, notifyPlanAndSlugRequired, privateAccessQuery]);

  const handleOpenViolationModal = React.useCallback(() => {
    setViolationModalVisible(true);
  }, []);

  const handleSubmitViolationReport = React.useCallback(() => {
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }

    const normalizedMessage = violationMessage.trim();
    if (normalizedMessage.length < 10) {
      toast.error(isUz ? 'Kamida 10 ta belgi kiriting' : 'Введите минимум 10 символов');
      return;
    }

    submitViolationReportMutation.mutate({
      type: violationType,
      message: normalizedMessage,
    });
  }, [isOnline, isUz, submitViolationReportMutation, violationMessage, violationType]);

  const handleAddPrivatePassword = React.useCallback(() => {
    if (!canUseCardFeatures) {
      notifyPlanAndSlugRequired();
      return;
    }
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }

    const password = String(privatePasswordValueInput || '').trim();
    const label = String(privatePasswordLabelInput || '').trim();
    if (privatePasswords.length >= privatePasswordLimit) {
      toast.error(isUz ? `Limit ${privatePasswordLimit} ta` : `Достигнут лимит ${privatePasswordLimit}`);
      return;
    }
    if (password.length < privatePasswordMinLength) {
      toast.error(isUz ? `Kamida ${privatePasswordMinLength} ta belgi` : `Минимум ${privatePasswordMinLength} символа`);
      return;
    }

    addPrivatePasswordMutation.mutate({ label, password });
  }, [
    addPrivatePasswordMutation,
    canUseCardFeatures,
    isOnline,
    isUz,
    notifyPlanAndSlugRequired,
    privatePasswordLabelInput,
    privatePasswordLimit,
    privatePasswordMinLength,
    privatePasswordValueInput,
    privatePasswords.length,
  ]);

  const handleStartChangePrivatePassword = React.useCallback((id: string) => {
    setChangePasswordId(id);
    setChangeOldPassword('');
    setChangeNewPassword('');
  }, []);

  const handleCancelChangePrivatePassword = React.useCallback(() => {
    setChangePasswordId(null);
    setChangeOldPassword('');
    setChangeNewPassword('');
  }, []);

  const handleSaveChangePrivatePassword = React.useCallback(() => {
    if (!changePasswordId) {
      return;
    }
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }

    const oldPassword = String(changeOldPassword || '').trim();
    const newPassword = String(changeNewPassword || '').trim();
    if (!oldPassword) {
      toast.error(isUz ? 'Eski parolni kiriting' : 'Введите старый пароль');
      return;
    }
    if (newPassword.length < privatePasswordMinLength) {
      toast.error(isUz ? `Kamida ${privatePasswordMinLength} ta belgi` : `Минимум ${privatePasswordMinLength} символа`);
      return;
    }

    changePrivatePasswordMutation.mutate({
      id: changePasswordId,
      oldPassword,
      newPassword,
    });
  }, [
    changeNewPassword,
    changeOldPassword,
    changePasswordId,
    changePrivatePasswordMutation,
    isOnline,
    isUz,
    privatePasswordMinLength,
  ]);

  const handleDeletePrivatePassword = React.useCallback((id: string) => {
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    deletePrivatePasswordMutation.mutate(id);
  }, [deletePrivatePasswordMutation, isOnline]);

  const handleSelectCardVisibility = React.useCallback((nextStatus: CardVisibilityStatus) => {
    if (!canUseCardFeatures) {
      notifyPlanAndSlugRequired();
      return;
    }
    if (!ownedSlugStatuses.length) {
      const message = isUz ? 'Slug topilmadi' : 'Slug не найден';
      setError(message);
      toast.error(message);
      return;
    }
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    updateCardVisibilityMutation.mutate(nextStatus);
  }, [
    canUseCardFeatures,
    isOnline,
    isUz,
    notifyPlanAndSlugRequired,
    ownedSlugStatuses.length,
    updateCardVisibilityMutation,
  ]);

  const handleOpenQr = React.useCallback(() => {
    if (!canUseCardFeatures) {
      notifyPlanAndSlugRequired();
      return;
    }
    setQrVisible(true);
  }, [canUseCardFeatures, notifyPlanAndSlugRequired]);

  const handleOpenShare = React.useCallback(() => {
    if (!canUseCardFeatures) {
      notifyPlanAndSlugRequired();
      return;
    }
    setShareVisible(true);
  }, [canUseCardFeatures, notifyPlanAndSlugRequired]);

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
      slugNotSelected: 'Slug hali tanlanmagan',
      nfcActive: '● NFC faol',
      qrTitle: 'QR-kod',
      qrSub: "Yuklab olish yoki ko'rsatish",
      shareTitle: 'Ulashish',
      shareSub: 'WhatsApp, Telegram...',
      cardLockedSub: 'Vizitka uchun avval SLUG va tarif kerak',
      editCard: 'Vizitkani tahrirlash',
      editCardSub: "Ism, havolalar, mavzu, tugmalar",
      wristband: 'Bilaguzuk va teglar',
      wristbandSub: 'Holat, tarix, buyurtma',
      settings: 'Sozlamalar',
      cardVisibility: 'Vizitka holati',
      cardVisibilitySubActive: 'Faol: ochiq va to‘liq ko‘rinadi',
      cardVisibilitySubPaused: 'Pauza: tashrif buyuruvchilar pauza sahifasini ko‘radi',
      cardVisibilitySubPrivate: 'Maxfiy: indekslanmaydi, faqat havola orqali',
      cardVisibilityMixed: 'Slug holatlari turlicha, bir xil holat qo‘llanadi',
      cardVisibilityModalTitle: 'Vizitka holatini tanlang',
      cardVisibilityModalHint: 'Tanlangan holat barcha sluglarga bir xil qo‘llanadi',
      cardVisibilityActive: 'Faol',
      cardVisibilityPaused: 'Pauza',
      cardVisibilityPrivate: 'Maxfiy',
      privateAccess: 'Maxfiy kirish parollari',
      privateAccessLockedSub: 'Parollar bilan yopiq vizitkani boshqarish',
      privateAccessModalTitle: 'Maxfiy kirish',
      privateAccessModalHint: 'Parollar 5 daqiqalik kirish beradi. Bir nechta parol yaratish mumkin.',
      privateAccessLabelPlaceholder: 'Yorliq (ixtiyoriy)',
      privateAccessPasswordPlaceholder: 'Yangi parol',
      privateAccessAdd: 'Qo‘shish',
      privateAccessPasswordLimit: 'Parollar',
      privateAccessPasswords: 'Parollar ro‘yxati',
      privateAccessEmpty: 'Hali parol qo‘shilmagan.',
      privateAccessNoLabel: 'Yorliqsiz',
      privateAccessCreatedAt: 'Yaratilgan',
      privateAccessLastUsedAt: 'Oxirgi foydalanish',
      privateAccessChange: 'Parolni almashtirish',
      privateAccessDelete: 'O‘chirish',
      privateAccessOldPlaceholder: 'Eski parol',
      privateAccessNewPlaceholder: 'Yangi parol',
      privateAccessSave: 'Saqlash',
      privateAccessCancel: 'Bekor qilish',
      privateAccessLogs: 'Kim ochgan',
      privateAccessLogsEmpty: 'Hali ochilishlar yo‘q.',
      privateAccessLogFrom: 'Slug',
      privateAccessLogDevice: 'Qurilma',
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
      reportViolation: 'Qoidabuzarlik haqida xabar berish',
      reportViolationSub: 'Bolalar xavfsizligi yoki boshqa qonunbuzarlik haqida yuboring',
      reportViolationModalTitle: 'Qoidabuzarlik haqida xabar',
      reportViolationModalHint: 'Xabar adminlarga yuboriladi va tekshirish uchun saqlanadi.',
      reportViolationTypeLabel: 'Qoidabuzarlik turi',
      reportViolationMessageLabel: 'Xabar tafsilotlari',
      reportViolationMessagePlaceholder: 'Nima bo‘lganini yozing...',
      reportViolationSubmit: 'Yuborish',
      violationTypeChildSafety: 'Bolalar xavfsizligi',
      violationTypeSexualContent: 'Seksual kontent',
      violationTypeViolence: 'Zo‘ravonlik',
      violationTypeFraud: 'Firibgarlik',
      violationTypeHateOrHarassment: 'Nafrat yoki tazyiq',
      violationTypeIllegalGoods: 'Noqonuniy tovar/xizmat',
      violationTypeOther: 'Boshqa',
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
      slugNotSelected: 'Slug пока не выбран',
      nfcActive: '● NFC активен',
      qrTitle: 'QR-код',
      qrSub: 'Скачать или показать',
      shareTitle: 'Поделиться',
      shareSub: 'WhatsApp, Telegram...',
      cardLockedSub: 'Сначала купите slug и тариф',
      editCard: 'Редактировать визитку',
      editCardSub: 'Имя, ссылки, тема, кнопки',
      wristband: 'Браслет и метки',
      wristbandSub: 'Статус, история, заказ',
      settings: 'Настройки',
      cardVisibility: 'Статус визитки',
      cardVisibilitySubActive: 'Активна: полностью доступна',
      cardVisibilitySubPaused: 'Пауза: посетители видят страницу паузы',
      cardVisibilitySubPrivate: 'Приватная: не индексируется, доступ по ссылке',
      cardVisibilityMixed: 'У slug разные статусы, применится единый',
      cardVisibilityModalTitle: 'Выберите статус визитки',
      cardVisibilityModalHint: 'Выбранный статус будет применён ко всем slug',
      cardVisibilityActive: 'Активная',
      cardVisibilityPaused: 'Пауза',
      cardVisibilityPrivate: 'Приватная',
      privateAccess: 'Пароли приватного доступа',
      privateAccessLockedSub: 'Управление доступом к закрытой визитке',
      privateAccessModalTitle: 'Приватный доступ',
      privateAccessModalHint: 'Каждый пароль открывает визитку на 5 минут. Можно создать несколько паролей.',
      privateAccessLabelPlaceholder: 'Метка (необязательно)',
      privateAccessPasswordPlaceholder: 'Новый пароль',
      privateAccessAdd: 'Добавить',
      privateAccessPasswordLimit: 'Пароли',
      privateAccessPasswords: 'Список паролей',
      privateAccessEmpty: 'Пока нет паролей.',
      privateAccessNoLabel: 'Без метки',
      privateAccessCreatedAt: 'Создан',
      privateAccessLastUsedAt: 'Последнее использование',
      privateAccessChange: 'Сменить пароль',
      privateAccessDelete: 'Удалить',
      privateAccessOldPlaceholder: 'Старый пароль',
      privateAccessNewPlaceholder: 'Новый пароль',
      privateAccessSave: 'Сохранить',
      privateAccessCancel: 'Отмена',
      privateAccessLogs: 'Кто открывал',
      privateAccessLogsEmpty: 'Пока нет открытий.',
      privateAccessLogFrom: 'Slug',
      privateAccessLogDevice: 'Устройство',
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
      reportViolation: 'Сообщить о правонарушении',
      reportViolationSub: 'Отправить жалобу о безопасности детей или другом нарушении',
      reportViolationModalTitle: 'Сообщение о правонарушении',
      reportViolationModalHint: 'Сообщение уйдёт администраторам и сохранится для проверки.',
      reportViolationTypeLabel: 'Тип правонарушения',
      reportViolationMessageLabel: 'Описание',
      reportViolationMessagePlaceholder: 'Опишите, что произошло...',
      reportViolationSubmit: 'Отправить',
      violationTypeChildSafety: 'Безопасность детей',
      violationTypeSexualContent: 'Сексуальный контент',
      violationTypeViolence: 'Насилие',
      violationTypeFraud: 'Мошенничество',
      violationTypeHateOrHarassment: 'Ненависть или травля',
      violationTypeIllegalGoods: 'Незаконные товары/услуги',
      violationTypeOther: 'Другое',
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
  const cardVisibilityLabel = currentCardVisibility === 'paused'
    ? profileText.cardVisibilityPaused
    : currentCardVisibility === 'private'
      ? profileText.cardVisibilityPrivate
      : profileText.cardVisibilityActive;
  const cardVisibilitySub = !canUseCardFeatures
    ? profileText.cardLockedSub
    : hasMixedCardVisibility
      ? profileText.cardVisibilityMixed
      : currentCardVisibility === 'paused'
        ? profileText.cardVisibilitySubPaused
        : currentCardVisibility === 'private'
          ? profileText.cardVisibilitySubPrivate
          : profileText.cardVisibilitySubActive;
  const privateAccessSub = !canUseCardFeatures
    ? profileText.cardLockedSub
    : privateAccessQuery.isFetching && !privateAccessQuery.data
      ? (isUz ? 'Yuklanmoqda...' : 'Загрузка...')
      : privateAccessQuery.isError
        ? (isUz ? 'Yuklashda xato' : 'Ошибка загрузки')
        : `${profileText.privateAccessPasswordLimit}: ${privatePasswords.length}/${privatePasswordLimit}`;
  const privateLimitReached = privatePasswords.length >= privatePasswordLimit;
  const violationTypeOptions = React.useMemo<Array<{ value: ViolationReportType; label: string }>>(
    () => [
      { value: 'child_safety', label: profileText.violationTypeChildSafety },
      { value: 'sexual_content', label: profileText.violationTypeSexualContent },
      { value: 'violence', label: profileText.violationTypeViolence },
      { value: 'fraud', label: profileText.violationTypeFraud },
      { value: 'hate_or_harassment', label: profileText.violationTypeHateOrHarassment },
      { value: 'illegal_goods', label: profileText.violationTypeIllegalGoods },
      { value: 'other', label: profileText.violationTypeOther },
    ],
    [profileText],
  );
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
                {hasOwnedSlug ? (
                  <Text style={[styles.slug, { color: tokens.textMuted }]}>
                    unqx.uz/<Text style={styles.slugStrong}>{formatSlug(card.slug)}</Text>
                  </Text>
                ) : (
                  <Text style={[styles.slug, { color: tokens.textMuted }]}>{profileText.slugNotSelected}</Text>
                )}
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
                style={[styles.shareCard, { backgroundColor: tokens.surface, borderColor: tokens.border }, !canUseCardFeatures && { opacity: 0.6 }]}
                onPress={handleOpenQr}
              >
                <QrCode size={22} strokeWidth={1.5} color={tokens.text} />
                <Text style={[styles.shareTitle, { color: tokens.text }]}>{profileText.qrTitle}</Text>
                <Text style={[styles.shareSub, { color: tokens.textMuted }]}>{canUseCardFeatures ? profileText.qrSub : profileText.cardLockedSub}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                containerStyle={styles.shareHalf}
                style={[styles.shareCard, { backgroundColor: tokens.surface, borderColor: tokens.border }, !canUseCardFeatures && { opacity: 0.6 }]}
                onPress={handleOpenShare}
              >
                <Share2 size={22} strokeWidth={1.5} color={tokens.text} />
                <Text style={[styles.shareTitle, { color: tokens.text }]}>{profileText.shareTitle}</Text>
                <Text style={[styles.shareSub, { color: tokens.textMuted }]}>{canUseCardFeatures ? profileText.shareSub : profileText.cardLockedSub}</Text>
              </AnimatedPressable>
            </View>

            {[
              {
                label: profileText.editCard,
                sub: canUseCardFeatures
                  ? profileText.editCardSub
                  : profileText.cardLockedSub,
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
                label={profileText.cardVisibility}
                sub={`${cardVisibilityLabel}. ${cardVisibilitySub}`}
                right={updateCardVisibilityMutation.isPending
                  ? <ActivityIndicator color={tokens.textMuted} />
                  : <ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={() => {
                  handleOpenCardVisibility();
                }}
              />
              <SettingsRow
                tokens={tokens}
                label={profileText.privateAccess}
                sub={privateAccessSub}
                right={(addPrivatePasswordMutation.isPending || changePrivatePasswordMutation.isPending || deletePrivatePasswordMutation.isPending || privateAccessQuery.isFetching)
                  ? <ActivityIndicator color={tokens.textMuted} />
                  : <ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={handleOpenPrivateAccess}
              />
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
                label={profileText.reportViolation}
                sub={profileText.reportViolationSub}
                right={submitViolationReportMutation.isPending
                  ? <ActivityIndicator color={tokens.textMuted} />
                  : <ChevronRight size={14} strokeWidth={1.5} color={tokens.textMuted} />}
                onPress={handleOpenViolationModal}
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

        <QRCodeModal visible={qrVisible && canUseCardFeatures} slug={card.slug} tokens={tokens} onClose={() => setQrVisible(false)} />
        <ShareSheet visible={shareVisible && canUseCardFeatures} slug={card.slug} name={card.name} tokens={tokens} onClose={() => setShareVisible(false)} />

        <Modal
          visible={cardVisibilityModalVisible}
          transparent={false}
          animationType='fade'
          onRequestClose={() => setCardVisibilityModalVisible(false)}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.bg }]} onPress={() => setCardVisibilityModalVisible(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={() => undefined}>
              <Text style={[styles.modalTitle, { color: tokens.text }]}>{profileText.cardVisibilityModalTitle}</Text>
              <Text style={[styles.modalHint, { color: tokens.textMuted }]}>{profileText.cardVisibilityModalHint}</Text>

              {([
                { value: 'active', label: profileText.cardVisibilityActive, sub: profileText.cardVisibilitySubActive },
                { value: 'paused', label: profileText.cardVisibilityPaused, sub: profileText.cardVisibilitySubPaused },
                { value: 'private', label: profileText.cardVisibilityPrivate, sub: profileText.cardVisibilitySubPrivate },
              ] as Array<{ value: CardVisibilityStatus; label: string; sub: string }>).map((item) => {
                const selected = currentCardVisibility === item.value && !hasMixedCardVisibility;
                return (
                  <Pressable
                    key={item.value}
                    style={[styles.languageOption, { borderColor: tokens.border, backgroundColor: selected ? `${tokens.accent}14` : 'transparent' }]}
                    onPress={() => {
                      handleSelectCardVisibility(item.value);
                    }}
                    disabled={updateCardVisibilityMutation.isPending}
                  >
                    <View style={styles.actionBody}>
                      <Text style={[styles.languageOptionLabel, { color: tokens.text }]}>{item.label}</Text>
                      <Text style={[styles.settingsSub, { color: tokens.textMuted }]}>{item.sub}</Text>
                    </View>
                    {updateCardVisibilityMutation.isPending && currentCardVisibility !== item.value ? (
                      <ActivityIndicator color={tokens.textMuted} />
                    ) : (
                      <Text style={[styles.languageOptionCheck, { color: selected ? tokens.accent : tokens.textMuted }]}>{selected ? '✓' : ''}</Text>
                    )}
                  </Pressable>
                );
              })}

              <Pressable style={[styles.modalCloseBtn, { borderColor: tokens.border }]} onPress={() => setCardVisibilityModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: tokens.text }]}>{profileText.modalClose}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

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
          visible={privateAccessModalVisible}
          transparent={false}
          animationType='fade'
          onRequestClose={() => setPrivateAccessModalVisible(false)}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.bg }]} onPress={() => setPrivateAccessModalVisible(false)}>
            <Pressable style={[styles.modalCard, styles.privateModalCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={() => undefined}>
              <Text style={[styles.modalTitle, { color: tokens.text }]}>{profileText.privateAccessModalTitle}</Text>
              <Text style={[styles.modalHint, { color: tokens.textMuted }]}>{profileText.privateAccessModalHint}</Text>

              <ScrollView
                style={styles.privateModalScroll}
                contentContainerStyle={styles.privateModalContent}
                keyboardShouldPersistTaps='handled'
                nestedScrollEnabled
              >
                <View style={styles.privateAddWrap}>
                  <TextInput
                    value={privatePasswordLabelInput}
                    onChangeText={setPrivatePasswordLabelInput}
                    placeholder={profileText.privateAccessLabelPlaceholder}
                    placeholderTextColor={tokens.textMuted}
                    style={[styles.privateInput, { borderColor: tokens.border, backgroundColor: tokens.inputBg, color: tokens.text }]}
                  />
                  <TextInput
                    value={privatePasswordValueInput}
                    onChangeText={setPrivatePasswordValueInput}
                    secureTextEntry
                    autoCapitalize='none'
                    autoCorrect={false}
                    placeholder={profileText.privateAccessPasswordPlaceholder}
                    placeholderTextColor={tokens.textMuted}
                    style={[styles.privateInput, { borderColor: tokens.border, backgroundColor: tokens.inputBg, color: tokens.text }]}
                  />
                  <Pressable
                    style={[
                      styles.privateAddButton,
                      {
                        borderColor: tokens.border,
                        opacity: addPrivatePasswordMutation.isPending || privateLimitReached ? 0.6 : 1,
                      },
                    ]}
                    disabled={addPrivatePasswordMutation.isPending || privateLimitReached}
                    onPress={handleAddPrivatePassword}
                  >
                    {addPrivatePasswordMutation.isPending ? (
                      <ActivityIndicator size='small' color={tokens.text} />
                    ) : (
                      <Text style={[styles.privateAddButtonText, { color: tokens.text }]}>{profileText.privateAccessAdd}</Text>
                    )}
                  </Pressable>
                </View>

                <Text style={[styles.privateCountText, { color: tokens.textMuted }]}>
                  {`${profileText.privateAccessPasswordLimit}: ${privatePasswords.length}/${privatePasswordLimit}`}
                </Text>

                <Text style={[styles.privateSectionTitle, { color: tokens.text }]}>{profileText.privateAccessPasswords}</Text>
                {privatePasswords.length ? (
                  privatePasswords.map((item) => {
                    const id = String(item.id || '');
                    const isChanging = changePasswordId === id;
                    const isDeleting = deletePrivatePasswordMutation.isPending && deletePrivatePasswordMutation.variables === id;
                    const label = String(item.label || '').trim() || profileText.privateAccessNoLabel;
                    return (
                      <View key={id} style={[styles.privateItem, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}>
                        <View style={styles.privateItemTop}>
                          <View style={styles.privateItemBody}>
                            <Text style={[styles.privateItemLabel, { color: tokens.text }]}>{label}</Text>
                            <Text style={[styles.privateItemMeta, { color: tokens.textMuted }]}>
                              {`${profileText.privateAccessCreatedAt}: ${formatDateTimeShort(item.createdAt, isUz)}`}
                            </Text>
                            <Text style={[styles.privateItemMeta, { color: tokens.textMuted }]}>
                              {`${profileText.privateAccessLastUsedAt}: ${formatDateTimeShort(item.lastUsedAt, isUz)}`}
                            </Text>
                          </View>
                          <View style={styles.privateItemActions}>
                            <Pressable
                              style={[styles.privateTinyButton, { borderColor: tokens.border }]}
                              onPress={() => {
                                if (isChanging) {
                                  handleCancelChangePrivatePassword();
                                } else {
                                  handleStartChangePrivatePassword(id);
                                }
                              }}
                            >
                              <Text style={[styles.privateTinyButtonText, { color: tokens.text }]}>{profileText.privateAccessChange}</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.privateTinyButton, { borderColor: tokens.border, opacity: isDeleting ? 0.6 : 1 }]}
                              disabled={isDeleting}
                              onPress={() => handleDeletePrivatePassword(id)}
                            >
                              {isDeleting ? (
                                <ActivityIndicator size='small' color={tokens.red} />
                              ) : (
                                <Text style={[styles.privateTinyButtonText, { color: tokens.red }]}>{profileText.privateAccessDelete}</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                        {isChanging ? (
                          <View style={styles.privateChangeWrap}>
                            <TextInput
                              value={changeOldPassword}
                              onChangeText={setChangeOldPassword}
                              secureTextEntry
                              autoCapitalize='none'
                              autoCorrect={false}
                              placeholder={profileText.privateAccessOldPlaceholder}
                              placeholderTextColor={tokens.textMuted}
                              style={[styles.privateInput, { borderColor: tokens.border, backgroundColor: tokens.surface, color: tokens.text }]}
                            />
                            <TextInput
                              value={changeNewPassword}
                              onChangeText={setChangeNewPassword}
                              secureTextEntry
                              autoCapitalize='none'
                              autoCorrect={false}
                              placeholder={profileText.privateAccessNewPlaceholder}
                              placeholderTextColor={tokens.textMuted}
                              style={[styles.privateInput, { borderColor: tokens.border, backgroundColor: tokens.surface, color: tokens.text }]}
                            />
                            <View style={styles.privateChangeActions}>
                              <Pressable
                                style={[styles.privateTinyButton, { borderColor: tokens.border, opacity: changePrivatePasswordMutation.isPending ? 0.6 : 1 }]}
                                disabled={changePrivatePasswordMutation.isPending}
                                onPress={handleSaveChangePrivatePassword}
                              >
                                {changePrivatePasswordMutation.isPending ? (
                                  <ActivityIndicator size='small' color={tokens.text} />
                                ) : (
                                  <Text style={[styles.privateTinyButtonText, { color: tokens.text }]}>{profileText.privateAccessSave}</Text>
                                )}
                              </Pressable>
                              <Pressable
                                style={[styles.privateTinyButton, { borderColor: tokens.border }]}
                                onPress={handleCancelChangePrivatePassword}
                              >
                                <Text style={[styles.privateTinyButtonText, { color: tokens.textMuted }]}>{profileText.privateAccessCancel}</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.privateEmptyText, { color: tokens.textMuted }]}>{profileText.privateAccessEmpty}</Text>
                )}

                <Text style={[styles.privateSectionTitle, { color: tokens.text }]}>{profileText.privateAccessLogs}</Text>
                {privateAccessLogs.length ? (
                  privateAccessLogs.map((item) => {
                    const label = String(item.passwordLabel || '').trim() || profileText.privateAccessNoLabel;
                    return (
                      <View key={item.id} style={[styles.privateLogItem, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}>
                        <Text style={[styles.privateItemLabel, { color: tokens.text }]}>{label}</Text>
                        <Text style={[styles.privateItemMeta, { color: tokens.textMuted }]}>
                          {`${profileText.privateAccessLogFrom}: ${formatSlug(item.slug || card.slug || '')}`}
                        </Text>
                        <Text style={[styles.privateItemMeta, { color: tokens.textMuted }]}>
                          {`${profileText.privateAccessLogDevice}: ${String(item.device || '—')}`}
                        </Text>
                        <Text style={[styles.privateItemMeta, { color: tokens.textMuted }]}>{formatDateTimeShort(item.createdAt, isUz)}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.privateEmptyText, { color: tokens.textMuted }]}>{profileText.privateAccessLogsEmpty}</Text>
                )}
              </ScrollView>

              <Pressable style={[styles.modalCloseBtn, { borderColor: tokens.border }]} onPress={() => setPrivateAccessModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: tokens.text }]}>{profileText.modalClose}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={violationModalVisible}
          transparent={false}
          animationType='fade'
          onRequestClose={() => setViolationModalVisible(false)}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: tokens.bg }]} onPress={() => setViolationModalVisible(false)}>
            <Pressable style={[styles.modalCard, styles.privateModalCard, styles.violationModalCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={() => undefined}>
              <Text style={[styles.modalTitle, { color: tokens.text }]}>{profileText.reportViolationModalTitle}</Text>
              <Text style={[styles.modalHint, { color: tokens.textMuted }]}>{profileText.reportViolationModalHint}</Text>

              <ScrollView
                style={styles.violationModalScroll}
                contentContainerStyle={styles.violationModalContent}
                keyboardShouldPersistTaps='handled'
                nestedScrollEnabled
              >
                <Text style={[styles.privateSectionTitle, { color: tokens.text }]}>{profileText.reportViolationTypeLabel}</Text>
                <View style={styles.violationTypeList}>
                  {violationTypeOptions.map((item) => {
                    const selected = item.value === violationType;
                    return (
                      <Pressable
                        key={item.value}
                        style={[styles.languageOption, { borderColor: tokens.border, backgroundColor: selected ? `${tokens.accent}14` : 'transparent' }]}
                        onPress={() => setViolationType(item.value)}
                        disabled={submitViolationReportMutation.isPending}
                      >
                        <Text style={[styles.languageOptionLabel, { color: tokens.text }]}>{item.label}</Text>
                        <Text style={[styles.languageOptionCheck, { color: selected ? tokens.accent : tokens.textMuted }]}>{selected ? '✓' : ''}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.privateSectionTitle, { color: tokens.text }]}>{profileText.reportViolationMessageLabel}</Text>
                <TextInput
                  value={violationMessage}
                  onChangeText={setViolationMessage}
                  multiline
                  textAlignVertical='top'
                  placeholder={profileText.reportViolationMessagePlaceholder}
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.violationMessageInput, { borderColor: tokens.border, backgroundColor: tokens.inputBg, color: tokens.text }]}
                  maxLength={3000}
                  editable={!submitViolationReportMutation.isPending}
                />

                <Text style={[styles.privateCountText, { color: tokens.textMuted }]}>
                  {`${violationMessage.trim().length}/3000`}
                </Text>
              </ScrollView>

              <View style={styles.violationModalActions}>
                <Pressable
                  style={[styles.violationSubmitButton, { borderColor: tokens.border, opacity: submitViolationReportMutation.isPending ? 0.7 : 1 }]}
                  disabled={submitViolationReportMutation.isPending}
                  onPress={handleSubmitViolationReport}
                >
                  {submitViolationReportMutation.isPending ? (
                    <ActivityIndicator size='small' color={tokens.text} />
                  ) : (
                    <Text style={[styles.privateAddButtonText, { color: tokens.text }]}>{profileText.reportViolationSubmit}</Text>
                  )}
                </Pressable>

                <Pressable style={[styles.modalCloseBtn, { borderColor: tokens.border }]} onPress={() => setViolationModalVisible(false)}>
                  <Text style={[styles.modalCloseText, { color: tokens.text }]}>{profileText.modalClose}</Text>
                </Pressable>
              </View>
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
      <View style={styles.settingsTextWrap}>
        <Text style={[styles.settingsTitle, { color: tokens.text }]}>{label}</Text>
        <Text style={[styles.settingsSub, { color: tokens.textMuted }]}>{sub}</Text>
      </View>
      <View style={styles.settingsRight}>{right}</View>
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
    overflow: 'hidden',
  },
  settingsRow: {
    minHeight: 58,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  settingsTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  settingsRight: {
    minWidth: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
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
  privateModalCard: {
    maxHeight: '86%',
  },
  privateModalScroll: {
    maxHeight: 520,
  },
  privateModalContent: {
    gap: 10,
    paddingBottom: 4,
  },
  privateAddWrap: {
    gap: 8,
  },
  privateInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  privateAddButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  privateAddButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  privateCountText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  privateSectionTitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  privateItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  privateItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  privateItemBody: {
    flex: 1,
  },
  privateItemLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  privateItemMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  privateItemActions: {
    gap: 6,
    alignItems: 'flex-end',
  },
  privateTinyButton: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateTinyButtonText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  privateChangeWrap: {
    gap: 8,
  },
  privateChangeActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  privateEmptyText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  privateLogItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  violationTypeList: {
    gap: 8,
  },
  violationModalCard: {
    maxHeight: '92%',
    width: '100%',
  },
  violationModalScroll: {
    flexShrink: 1,
    maxHeight: 480,
  },
  violationModalContent: {
    gap: 10,
    paddingBottom: 4,
  },
  violationModalActions: {
    gap: 8,
  },
  violationMessageInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  violationSubmitButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
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
    paddingVertical: 16,
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
