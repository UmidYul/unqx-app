import React from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronLeft, Download, Globe, Hash, Lock, Mail, MapPin, Phone, Search, Star, UserCheck, UserPlus } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { findButtonIcon, inferButtonIcon } from '@/components/profile/buttonIcons';
import { ScreenTransition } from '@/components/ScreenTransition';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCircle } from '@/components/ui/skeleton';
import { MESSAGES } from '@/constants/messages';
import { useExport } from '@/hooks/useExport';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
import { queryKeys } from '@/lib/queryKeys';
import { ApiError, apiClient } from '@/lib/apiClient';
import {
  clearResidentPrivateAccessLike,
  fetchResidentProfileLike,
  saveContactLike,
  subscribeContactLike,
  unlockResidentPrivateProfileLike,
} from '@/services/mobileApi';
import { ResidentProfile } from '@/types';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { useThemeContext } from '@/theme/ThemeProvider';
import { formatSlug } from '@/utils/avatar';
import { getPreferredTelegramUrl } from '@/utils/links';
import { toast } from '@/utils/toast';

function normalizeResidentSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

function initial(name: string): string {
  return (name || 'U').charAt(0).toUpperCase();
}

function normalizeAddress(value?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  if (/^\d+$/.test(raw)) {
    return '';
  }
  return raw;
}

function isCallButton(label: string, icon?: string): boolean {
  const normalizedLabel = String(label ?? '').trim().toLowerCase();
  const normalizedIcon = String(icon ?? '').trim().toLowerCase();
  if (normalizedIcon === 'phone') {
    return true;
  }
  return ['позвон', 'звон', 'call', 'phone', 'telefon', 'телефон'].some((token) => normalizedLabel.includes(token));
}

function isCopyCardButton(label: string): boolean {
  const normalizedLabel = String(label ?? '').trim().toLowerCase();
  return ['карта', 'card', 'karta'].some((token) => normalizedLabel.includes(token));
}

function toDialUrl(raw: string): string | null {
  const value = String(raw ?? '').trim();
  if (!value) {
    return null;
  }
  if (/^tel:/i.test(value)) {
    return value;
  }

  const normalized = value.replace(/[^\d+]/g, '');
  if (!/^\+?\d{7,15}$/.test(normalized)) {
    return null;
  }

  return `tel:${normalized}`;
}

function parseNumeric(value: unknown): number | null {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return null;
  }
  return next;
}

function normalizeTag(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function formatCompact(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  } catch {
    return String(value);
  }
}

function VerificationIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <Svg width={14} height={14} viewBox='0 0 24 24'>
      <Path
        fill={color}
        d='M12 2.5l2.2 1.8 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L21.5 12l-1.8 2.2.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 21.5l-2.2-1.8-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2.5 12l1.8-2.2-.3-2.8 2.5-1.2 1.2-2.5 2.8.3L12 2.5Zm-1.1 13.1 5-5-1.1-1.1-3.9 3.9-1.8-1.8-1.1 1.1 2.9 2.9Z'
      />
    </Svg>
  );
}

export default function ResidentProfilePage(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();
  const isUz = language === 'uz';
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { exportVCF } = useExport();

  const profileText = isUz
    ? {
      title: 'Profil',
      invalidSlug: 'Foydalanuvchi slugi noto\'g\'ri',
      loadFailed: 'Foydalanuvchi profilini yuklab bo\'lmadi',
      premium: 'Premium',
      basic: 'Asosiy',
      taps: 'tap',
      inFavorites: 'Sevimlida',
      toFavorites: 'Sevimliga',
      inContacts: 'Kontaktlarda',
      toContacts: 'Kontaktlarga',
      summary: 'Qisqacha',
      noSummary: 'Foydalanuvchi hali qisqacha ma\'lumot qo\'shmagan',
      contacts: 'Kontaktlar',
      links: 'Havolalar',
      saveVcf: 'Kontaktni saqlash',
      openCard: 'Vizitkani ochish',
      cardDetails: 'Vizitka ma\'lumotlari',
      slugPrice: 'Slug narxi',
      totalSlugPrice: 'Jami slug narxi',
      views: 'ko\'rishlar',
      back: 'Orqaga',
      searchSlug: 'Slug qidirish',
      buySlug: 'Sotib olish',
      slugAvailable: 'Slug bo\'sh',
      slugTaken: 'Slug band',
      searchError: 'Slug bo\'yicha qidirib bo\'lmadi',
      rating: 'Reyting',
      top: 'Top',
      actions: 'Harakatlar',
      scoreBlock: 'UNQ SCORE',
      rarity: 'Noyoblik',
      tags: 'Teglar',
      slugs: 'Sluglar',
      badgeLeaderboard: 'TOP',
      badgePlan: 'Tarif',
      badgeScore: 'UNQ',
      email: 'Email',
      phone: 'Telefon',
      address: 'Manzil',
      postcode: 'Indeks',
      openLinkFailed: 'Havolani ochib bo\'lmadi',
      openPhoneFailed: 'Telefon raqamini ochib bo\'lmadi',
      openCardFailed: 'Vizitkani ochib bo\'lmadi',
      cardCopied: 'Karta nusxalandi',
      copyCardFailed: 'Kartani nusxalab bo\'lmadi',
      addedToContacts: 'Kontaktlarga qo\'shildi',
      removedFromContacts: 'Kontaktlardan olib tashlandi',
      privateTitle: 'Yopiq akkaunt',
      privateSubtitle: 'Ko\'rish uchun parol kiriting',
      privatePlaceholder: 'Parol',
      privateUnlock: 'Ochish',
      privateUnlockFailed: 'Parol noto\'g\'ri',
      privateUnlockExpired: 'Sessiya tugadi. Parolni qayta kiriting.',
    }
    : {
      title: 'Профиль',
      invalidSlug: 'Некорректный slug пользователя',
      loadFailed: 'Не удалось загрузить профиль пользователя',
      premium: 'Премиум',
      basic: 'Базовый',
      taps: 'тапов',
      inFavorites: 'В избранном',
      toFavorites: 'В избранное',
      inContacts: 'В контактах',
      toContacts: 'В контакты',
      summary: 'О себе',
      noSummary: 'Пользователь пока не добавил резюме',
      contacts: 'Контакты',
      links: 'Ссылки',
      saveVcf: 'Скачать контакт',
      openCard: 'Открыть визитку',
      cardDetails: 'Данные визитки',
      slugPrice: 'Цена slug',
      totalSlugPrice: 'Общая цена slug',
      views: 'просмотров',
      back: 'Назад',
      searchSlug: 'Поиск slug',
      buySlug: 'Купить',
      slugAvailable: 'Slug свободен',
      slugTaken: 'Slug занят',
      searchError: 'Не удалось выполнить поиск slug',
      rating: 'Рейтинг',
      top: 'Топ',
      actions: 'Действия',
      scoreBlock: 'UNQ SCORE',
      rarity: 'Редкость',
      tags: 'Теги',
      slugs: 'Slug',
      badgeLeaderboard: 'ТОП',
      badgePlan: 'Тариф',
      badgeScore: 'UNQ',
      email: 'Email',
      phone: 'Телефон',
      address: 'Адрес',
      postcode: 'Индекс',
      openLinkFailed: 'Не удалось открыть ссылку',
      openPhoneFailed: 'Не удалось открыть номер телефона',
      openCardFailed: 'Не удалось открыть визитку',
      cardCopied: 'Карта скопирована',
      copyCardFailed: 'Не удалось скопировать карту',
      addedToContacts: 'Добавлено в контакты',
      removedFromContacts: 'Удалено из контактов',
      privateTitle: 'Закрытый аккаунт',
      privateSubtitle: 'Введите пароль для просмотра',
      privatePlaceholder: 'Пароль',
      privateUnlock: 'Открыть',
      privateUnlockFailed: 'Неверный пароль',
      privateUnlockExpired: 'Сеанс истёк. Введите пароль снова.',
    };

  const normalizedSlug = React.useMemo(() => {
    const value = Array.isArray(slug) ? slug[0] : slug;
    return normalizeResidentSlug(value);
  }, [slug]);

  const profileQuery = useQuery({
    queryKey: queryKeys.residentProfile(normalizedSlug),
    queryFn: () => fetchResidentProfileLike(normalizedSlug),
    enabled: Boolean(normalizedSlug),
  });
  const leaderboardQuery = useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: () => apiClient.getFirst<any>(['/leaderboard']),
    enabled: Boolean(normalizedSlug),
    staleTime: 3 * 60 * 1000,
  });

  const profile = profileQuery.data;
  const avatarImage = useRetryImageUri(profile?.avatarUrl);
  const contactAddress = React.useMemo(() => normalizeAddress(profile?.address ?? profile?.city), [profile?.address, profile?.city]);
  const residentSlugs = React.useMemo(() => {
    const set = new Set<string>();
    const push = (value: unknown) => {
      const normalized = normalizeResidentSlug(value);
      if (normalized) {
        set.add(normalized);
      }
    };

    if (Array.isArray(profile?.slugs)) {
      for (const candidate of profile.slugs) {
        push(candidate);
      }
    }
    push(profile?.slug);

    return Array.from(set);
  }, [profile?.slug, profile?.slugs]);
  const hasVerifiedBadge = Boolean(profile?.verified || profile?.verifiedCompany);
  const companyLabel = String(profile?.verifiedCompany ?? '').trim();
  const locale = isUz ? 'uz-UZ' : 'ru-RU';
  const runtimeProfile = profile as
    | (ResidentProfile & {
      tags?: unknown;
      hashtag?: unknown;
      postcode?: unknown;
      totalSlugsPrice?: unknown;
      slugsTotalPrice?: unknown;
      totalSlugPrice?: unknown;
      plan?: unknown;
      score?: unknown;
      unqScore?: unknown;
      scoreValue?: unknown;
      scorePercent?: unknown;
      scoreProgress?: unknown;
      topPercent?: unknown;
      top?: unknown;
      percentile?: unknown;
      ratingTopPercent?: unknown;
      ratingPercent?: unknown;
      leaderboardPosition?: unknown;
      rank?: unknown;
      position?: unknown;
      place?: unknown;
      rarity?: unknown;
      scoreRarity?: unknown;
    })
    | undefined;
  const profilePostcode = String(runtimeProfile?.postcode ?? '').trim();
  const profileHashtag = String(runtimeProfile?.hashtag ?? '').trim();
  const normalizedProfileHashtag = profileHashtag ? normalizeTag(profileHashtag) : '';
  const profileTags = React.useMemo(() => {
    if (!Array.isArray(runtimeProfile?.tags)) {
      return [] as string[];
    }
    return runtimeProfile.tags
      .map((value) => normalizeTag(String(value ?? '')))
      .filter(Boolean);
  }, [runtimeProfile?.tags]);
  const shouldShowCenterHashtag = Boolean(normalizedProfileHashtag)
    && !profileTags.some((tag) => tag.toLowerCase() === normalizedProfileHashtag.toLowerCase());
  const leaderboardPosition = parseNumeric(
    runtimeProfile?.leaderboardPosition ?? runtimeProfile?.rank ?? runtimeProfile?.position ?? runtimeProfile?.place,
  );
  const scoreValue = parseNumeric(runtimeProfile?.score ?? runtimeProfile?.unqScore ?? runtimeProfile?.scoreValue) ?? 0;
  const topPercent = parseNumeric(
    runtimeProfile?.topPercent
    ?? runtimeProfile?.top
    ?? runtimeProfile?.percentile
    ?? runtimeProfile?.ratingTopPercent
    ?? runtimeProfile?.ratingPercent,
  );
  const leaderboardFallback = React.useMemo(() => {
    const source = leaderboardQuery.data;
    const items = Array.isArray((source as any)?.items)
      ? (source as any).items
      : (Array.isArray(source) ? source : []);
    if (!Array.isArray(items) || !normalizedSlug) {
      return { rank: null as number | null, score: null as number | null, topPercent: null as number | null };
    }

    const match = items.find(
      (item: any) => normalizeResidentSlug(item?.slug ?? item?.fullSlug) === normalizedSlug,
    );
    if (!match) {
      return { rank: null as number | null, score: null as number | null, topPercent: null as number | null };
    }

    return {
      rank: parseNumeric(match?.rank ?? match?.position ?? match?.place),
      score: parseNumeric(match?.score ?? match?.unqScore ?? match?.scoreValue),
      topPercent: parseNumeric(
        match?.topPercent
        ?? match?.top
        ?? match?.percentile
        ?? match?.ratingTopPercent
        ?? match?.ratingPercent,
      ),
    };
  }, [leaderboardQuery.data, normalizedSlug]);
  const resolvedLeaderboardPosition = leaderboardPosition ?? leaderboardFallback.rank;
  const resolvedScoreValue = scoreValue > 0 ? scoreValue : (leaderboardFallback.score ?? 0);
  const resolvedTopPercent = topPercent ?? leaderboardFallback.topPercent;
  const planKey = String(runtimeProfile?.plan ?? profile?.tag ?? '').trim().toLowerCase();
  const planLabel = planKey === 'premium'
    ? profileText.premium
    : (planKey === 'basic' ? profileText.basic : (planKey || profileText.basic));
  const contactRows = React.useMemo(() => {
    const rows = [
      { key: 'email', icon: Mail, label: profileText.email, value: String(profile?.email ?? '').trim() },
      { key: 'phone', icon: Phone, label: profileText.phone, value: String(profile?.phone ?? '').trim() },
      { key: 'address', icon: MapPin, label: profileText.address, value: contactAddress },
      { key: 'postcode', icon: Hash, label: profileText.postcode, value: profilePostcode },
    ];
    return rows.filter((row) => Boolean(row.value));
  }, [
    contactAddress,
    profile?.email,
    profile?.phone,
    profilePostcode,
    profileText.address,
    profileText.email,
    profileText.phone,
    profileText.postcode,
  ]);
  const hasContacts = contactRows.length > 0;
  const hasScoreBlock = resolvedScoreValue > 0;
  const links = Array.isArray(profile?.buttons) ? profile.buttons : [];
  const [searchSlugValue, setSearchSlugValue] = React.useState(normalizedSlug);
  const [lookupPending, setLookupPending] = React.useState(false);
  const [lookupResult, setLookupResult] = React.useState<{
    slug: string;
    available: boolean;
    price: number | null;
    profile: ResidentProfile | null;
  } | null>(null);
  const lookupRequestIdRef = React.useRef(0);
  const lookupAvatar = useRetryImageUri(lookupResult?.profile?.avatarUrl);
  const [privatePassword, setPrivatePassword] = React.useState('');
  const [privateError, setPrivateError] = React.useState('');
  const lockShake = useSharedValue(0);
  const lockShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lockShake.value }],
  }));

  const triggerLockShake = React.useCallback(() => {
    lockShake.value = withSequence(
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 45 }),
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
  }, [lockShake]);

  const saveMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: () => saveContactLike(normalizedSlug),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.residentProfile(normalizedSlug) });
      const previous = queryClient.getQueryData<ResidentProfile>(queryKeys.residentProfile(normalizedSlug));
      const nextSaved = !Boolean(previous?.saved);
      queryClient.setQueryData<ResidentProfile>(queryKeys.residentProfile(normalizedSlug), (old) =>
        old ? { ...old, saved: nextSaved } : old,
      );
      return { previous, nextSaved };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.residentProfile(normalizedSlug), context.previous);
      }
      toast.error(MESSAGES.toast.saveFailed);
    },
    onSuccess: (_data, _variables, context) => {
      toast.success(context?.nextSaved ? MESSAGES.toast.favoritesAdded : MESSAGES.toast.favoritesRemoved);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.residentProfile(normalizedSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      void queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });

  const subscribeMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: () => subscribeContactLike(normalizedSlug),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.residentProfile(normalizedSlug) });
      const previous = queryClient.getQueryData<ResidentProfile>(queryKeys.residentProfile(normalizedSlug));
      const nextSubscribed = !Boolean(previous?.subscribed);
      queryClient.setQueryData<ResidentProfile>(queryKeys.residentProfile(normalizedSlug), (old) =>
        old ? { ...old, subscribed: nextSubscribed } : old,
      );
      return { previous, nextSubscribed };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.residentProfile(normalizedSlug), context.previous);
      }
      toast.error(MESSAGES.toast.subscribeFailed);
    },
    onSuccess: (_data, _variables, context) => {
      toast.success(context?.nextSubscribed ? profileText.addedToContacts : profileText.removedFromContacts);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.residentProfile(normalizedSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      void queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });

  const unlockMutation = useMutation({
    networkMode: 'online',
    mutationFn: () => unlockResidentPrivateProfileLike(normalizedSlug, privatePassword),
    onSuccess: async () => {
      setPrivateError('');
      setPrivatePassword('');
      await profileQuery.refetch();
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : null;
      setPrivateError(code === 'PRIVATE_ACCESS_INVALID_PASSWORD' ? profileText.privateUnlockFailed : profileText.loadFailed);
      triggerLockShake();
    },
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      profileQuery.refetch(),
      leaderboardQuery.refetch(),
    ]);
  }, [leaderboardQuery, profileQuery]);

  React.useEffect(() => {
    if (!normalizedSlug || !profile?.isPrivate || profile?.isLocked) {
      return;
    }
    const expiresAtMs = Date.parse(String(profile.privateAccessExpiresAt ?? ''));
    if (!Number.isFinite(expiresAtMs)) {
      return;
    }

    const remaining = expiresAtMs - Date.now();
    if (remaining <= 0) {
      void clearResidentPrivateAccessLike(normalizedSlug).then(() => profileQuery.refetch());
      setPrivateError(profileText.privateUnlockExpired);
      return;
    }

    const timerId = setTimeout(() => {
      void clearResidentPrivateAccessLike(normalizedSlug).then(() => profileQuery.refetch());
      setPrivateError(profileText.privateUnlockExpired);
    }, remaining + 20);

    return () => clearTimeout(timerId);
  }, [
    normalizedSlug,
    profile?.isPrivate,
    profile?.isLocked,
    profile?.privateAccessExpiresAt,
    profileQuery,
    profileText.privateUnlockExpired,
  ]);

  React.useEffect(() => {
    if (!profile?.isLocked) {
      setPrivateError('');
      setPrivatePassword('');
    }
  }, [profile?.isLocked]);

  const handleUnlockPrivateProfile = React.useCallback(() => {
    if (!normalizedSlug) {
      return;
    }
    const password = privatePassword.trim();
    if (!password) {
      setPrivateError(profileText.privateUnlockFailed);
      triggerLockShake();
      return;
    }
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    setPrivateError('');
    unlockMutation.mutate();
  }, [
    isOnline,
    normalizedSlug,
    privatePassword,
    profileText.privateUnlockFailed,
    triggerLockShake,
    unlockMutation,
  ]);

  const handleExportProfileVcf = React.useCallback(() => {
    if (!profile) {
      return;
    }

    void exportVCF([
      {
        name: profile.name,
        slug: profile.slug,
        phone: profile.phone,
        email: profile.email,
        company: profile.role || profile.city,
      },
    ]);
  }, [exportVCF, profile]);

  const handleOpenCard = React.useCallback(() => {
    if (!profile?.slug) {
      return;
    }

    void Linking.openURL(`https://unqx.uz/${profile.slug}`).catch(() => {
      toast.error(profileText.openCardFailed);
    });
  }, [profile?.slug, profileText.openCardFailed]);

  const handleOpenButtonUrl = React.useCallback(async (button: { label: string; url: string; icon?: string }) => {
    const rawUrl = String(button.url ?? '').trim();
    if (!rawUrl) {
      toast.error(profileText.openLinkFailed);
      return;
    }

    if (isCopyCardButton(button.label) || /^copy:/i.test(rawUrl)) {
      const valueToCopy = rawUrl.replace(/^copy:/i, '').trim();
      try {
        await Clipboard.setStringAsync(valueToCopy || rawUrl);
        toast.success(profileText.cardCopied);
      } catch {
        toast.error(profileText.copyCardFailed);
      }
      return;
    }

    if (isCallButton(button.label, button.icon)) {
      const dialUrl = toDialUrl(rawUrl);
      if (!dialUrl) {
        toast.error(profileText.openPhoneFailed);
        return;
      }
      try {
        await Linking.openURL(dialUrl);
      } catch {
        toast.error(profileText.openPhoneFailed);
      }
      return;
    }

    const telegramAppUrl = getPreferredTelegramUrl(rawUrl);

    try {
      if (telegramAppUrl) {
        const canOpenTelegram = await Linking.canOpenURL(telegramAppUrl);
        await Linking.openURL(canOpenTelegram ? telegramAppUrl : rawUrl);
        return;
      }
      await Linking.openURL(rawUrl);
    } catch {
      toast.error(profileText.openLinkFailed);
    }
  }, [profileText.cardCopied, profileText.copyCardFailed, profileText.openLinkFailed, profileText.openPhoneFailed]);

  const handleToggleSaved = React.useCallback(() => {
    if (!normalizedSlug) {
      return;
    }
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    saveMutation.mutate();
  }, [isOnline, normalizedSlug, saveMutation]);

  const handleToggleContact = React.useCallback(() => {
    if (!normalizedSlug) {
      return;
    }
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    subscribeMutation.mutate();
  }, [isOnline, normalizedSlug, subscribeMutation]);

  React.useEffect(() => {
    setSearchSlugValue(normalizedSlug);
  }, [normalizedSlug]);

  const performLookupSlug = React.useCallback(async (rawSlug: string, silent: boolean) => {
    const targetSlug = normalizeResidentSlug(rawSlug);
    if (!targetSlug) {
      setLookupResult(null);
      return;
    }
    if (!isOnline) {
      if (!silent) {
        toast.info(MESSAGES.toast.offlineQueued);
      }
      return;
    }

    const requestId = lookupRequestIdRef.current + 1;
    lookupRequestIdRef.current = requestId;
    setLookupPending(true);
    try {
      const [availabilitySettled, priceSettled, profileSettled] = await Promise.allSettled([
        apiClient.get<any>('/cards/availability', { query: { slug: targetSlug } }),
        apiClient.get<any>('/cards/slug-price', { query: { slug: targetSlug } }),
        fetchResidentProfileLike(targetSlug),
      ]);

      const availabilityPayload = availabilitySettled.status === 'fulfilled' ? availabilitySettled.value : null;
      const availableFromApi = typeof availabilityPayload?.available === 'boolean'
        ? availabilityPayload.available
        : (typeof availabilityPayload?.item?.available === 'boolean' ? availabilityPayload.item.available : null);

      const pricePayload = priceSettled.status === 'fulfilled' ? priceSettled.value : null;
      const numericPrice = parseNumeric(
        pricePayload?.slugPrice
        ?? pricePayload?.price
        ?? pricePayload?.amount
        ?? availabilityPayload?.slugPrice
        ?? availabilityPayload?.item?.slugPrice,
      );

      const profileCandidate = profileSettled.status === 'fulfilled' ? profileSettled.value : null;
      const resolvedAvailable = availableFromApi !== null ? availableFromApi : !profileCandidate;

      if (lookupRequestIdRef.current !== requestId) {
        return;
      }
      setLookupResult({
        slug: targetSlug,
        available: resolvedAvailable,
        price: numericPrice,
        profile: resolvedAvailable ? null : profileCandidate,
      });
    } catch {
      if (!silent) {
        toast.error(profileText.searchError);
      }
    } finally {
      if (lookupRequestIdRef.current === requestId) {
        setLookupPending(false);
      }
    }
  }, [isOnline, profileText.searchError]);

  const handleLookupSlug = React.useCallback(async () => {
    await performLookupSlug(searchSlugValue, false);
  }, [performLookupSlug, searchSlugValue]);

  const handleSearchSlugChange = React.useCallback((value: string) => {
    setSearchSlugValue(value);
    if (!normalizeResidentSlug(value)) {
      // Invalidate any in-flight lookup so stale responses cannot restore old result.
      lookupRequestIdRef.current += 1;
      setLookupResult(null);
      setLookupPending(false);
    }
  }, []);

  React.useEffect(() => {
    const targetSlug = normalizeResidentSlug(searchSlugValue);
    if (!targetSlug) {
      lookupRequestIdRef.current += 1;
      setLookupResult(null);
      setLookupPending(false);
      return;
    }

    const timerId = setTimeout(() => {
      void performLookupSlug(searchSlugValue, true);
    }, 300);

    return () => clearTimeout(timerId);
  }, [performLookupSlug, searchSlugValue]);

  const handleBuySlug = React.useCallback(async () => {
    const targetSlug = lookupResult?.slug ? encodeURIComponent(lookupResult.slug) : '';
    if (!targetSlug) {
      return;
    }
    await Linking.openURL(`https://unqx.uz/?slug=${targetSlug}`).catch(() => {
      toast.error(profileText.openLinkFailed);
    });
  }, [lookupResult?.slug, profileText.openLinkFailed]);

  const viewsValue = Number(profile?.taps ?? 0);
  const priceValue = typeof profile?.slugPrice === 'number' && Number.isFinite(profile.slugPrice)
    ? `${profile.slugPrice.toLocaleString(locale)} сум`
    : '—';
  const totalSlugsPrice = parseNumeric(
    runtimeProfile?.totalSlugsPrice ?? runtimeProfile?.slugsTotalPrice ?? runtimeProfile?.totalSlugPrice,
  );
  const totalPriceValue = totalSlugsPrice !== null
    ? `${totalSlugsPrice.toLocaleString(locale)} сум`
    : priceValue;
  const scoreMetricValue = hasScoreBlock ? formatCompact(resolvedScoreValue, locale) : '—';
  const roundedTopPercent = resolvedTopPercent !== null ? Math.max(0, Math.round(resolvedTopPercent)) : null;
  const ratingValue = roundedTopPercent !== null
    ? `${profileText.top} ${roundedTopPercent}%`
    : (resolvedLeaderboardPosition !== null && resolvedLeaderboardPosition > 0 ? `#${Math.round(resolvedLeaderboardPosition)}` : '—');
  const footerViewsText = `${viewsValue.toLocaleString(locale)} ${profileText.views}`;
  const lookupPriceText = lookupResult?.price !== null && lookupResult?.price !== undefined
    ? `${lookupResult.price.toLocaleString(locale)} сум`
    : '—';

  if (!normalizedSlug) {
    return (
      <ErrorBoundary>
        <AppShell title={profileText.title} tokens={tokens}>
          <ErrorState
            tokens={tokens}
            text={profileText.invalidSlug}
            onRetry={() => {
              void profileQuery.refetch();
            }}
          />
        </AppShell>
      </ErrorBoundary>
    );
  }

  if (profileQuery.isLoading && !profile) {
    return (
      <AppShell title={profileText.title} tokens={tokens}>
        <View style={styles.skeletonWrap}>
          <View style={[styles.heroCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <SkeletonCircle tokens={tokens} size={64} />
            <View style={styles.skeletonBody}>
              <SkeletonBlock tokens={tokens} height={16} width='56%' />
              <SkeletonBlock tokens={tokens} height={12} width='46%' />
              <View style={styles.skeletonPills}>
                <SkeletonBlock tokens={tokens} height={20} width={84} radius={6} />
                <SkeletonBlock tokens={tokens} height={20} width={102} radius={6} />
              </View>
            </View>
          </View>
          <View style={styles.skeletonActions}>
            <SkeletonBlock tokens={tokens} height={48} radius={12} style={styles.skeletonAction} />
            <SkeletonBlock tokens={tokens} height={48} radius={12} style={styles.skeletonAction} />
          </View>
          <SkeletonBlock tokens={tokens} height={120} radius={12} />
          <SkeletonBlock tokens={tokens} height={140} radius={12} />
        </View>
      </AppShell>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <ErrorBoundary>
        <AppShell title={profileText.title} tokens={tokens}>
          <ErrorState
            tokens={tokens}
            text={profileText.loadFailed}
            onRetry={() => {
              void profileQuery.refetch();
            }}
          />
        </AppShell>
      </ErrorBoundary>
    );
  }

  if (profile.isPrivate && profile.isLocked) {
    return (
      <ErrorBoundary>
        <AppShell title={profileText.title} tokens={tokens}>
          <ScreenTransition>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps='handled'
              refreshControl={
                <RefreshControl
                  refreshing={profileQuery.isRefetching}
                  onRefresh={() => void onRefresh()}
                  tintColor={tokens.accent}
                  colors={[tokens.accent]}
                />
              }
            >
              <View style={styles.slugLookupWrap}>
                <View style={styles.slugLookupTopRow}>
                  <AnimatedPressable
                    style={[styles.backButton, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
                    onPress={() => router.back()}
                  >
                    <ChevronLeft size={16} color={tokens.text} strokeWidth={1.8} />
                    <Text style={[styles.backButtonText, { color: tokens.text }]}>{profileText.back}</Text>
                  </AnimatedPressable>
                  <View style={[styles.slugSearchBox, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                    <Text style={[styles.slugPrefix, { color: tokens.textMuted }]}>unqx.uz/</Text>
                    <TextInput
                      value={searchSlugValue}
                      onChangeText={handleSearchSlugChange}
                      placeholder={profileText.searchSlug}
                      placeholderTextColor={tokens.textMuted}
                      autoCapitalize='characters'
                      autoCorrect={false}
                      style={[styles.slugSearchInput, { color: tokens.text }]}
                    />
                  </View>
                  <AnimatedPressable
                    style={[styles.slugSearchAction, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
                    onPress={() => {
                      void handleLookupSlug();
                    }}
                  >
                    {lookupPending ? (
                      <ActivityIndicator size='small' color={tokens.text} />
                    ) : (
                      <Search size={16} color={tokens.text} strokeWidth={1.8} />
                    )}
                  </AnimatedPressable>
                </View>
                {lookupResult ? (
                  <View style={[styles.lookupResultCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                    {lookupResult.available ? (
                      <>
                        <View style={styles.lookupResultInfo}>
                          <Text style={[styles.lookupSlug, { color: tokens.text }]}>{lookupResult.slug}</Text>
                          <Text style={[styles.lookupStatus, { color: tokens.textMuted }]}>{profileText.slugAvailable}</Text>
                        </View>
                        <View style={styles.lookupResultRight}>
                          <Text style={[styles.lookupPrice, { color: tokens.text }]}>{lookupPriceText}</Text>
                          <AnimatedPressable
                            style={[styles.buyButton, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}
                            onPress={() => {
                              void handleBuySlug();
                            }}
                          >
                            <Text style={[styles.buyButtonText, { color: tokens.text }]}>{profileText.buySlug}</Text>
                          </AnimatedPressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.lookupAvatarWrap}>
                          {lookupAvatar.showImage && lookupAvatar.imageUri ? (
                            <Image
                              key={`${lookupResult.profile?.avatarUrl}:${lookupAvatar.retryCount}`}
                              source={{ uri: lookupAvatar.imageUri }}
                              style={styles.lookupAvatar}
                              onError={lookupAvatar.onError}
                            />
                          ) : (
                            <View style={[styles.lookupAvatar, { backgroundColor: tokens.inputBg }]}>
                              <Text style={[styles.lookupAvatarText, { color: tokens.textMuted }]}>
                                {initial(lookupResult.profile?.name ?? lookupResult.slug)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.lookupResultInfo}>
                          <Text style={[styles.lookupSlug, { color: tokens.text }]}>{lookupResult.slug}</Text>
                          <Text style={[styles.lookupName, { color: tokens.textSub }]}>
                            {lookupResult.profile?.name || profileText.slugTaken}
                          </Text>
                        </View>
                        <View style={styles.lookupResultRight}>
                          <Text style={[styles.lookupPrice, { color: tokens.text }]}>{lookupPriceText}</Text>
                        </View>
                      </>
                    )}
                  </View>
                ) : null}
              </View>

              <View style={[styles.heroCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                <View style={styles.heroAvatarWrap}>
                  {avatarImage.showImage && avatarImage.imageUri ? (
                    <Image
                      key={`${profile.avatarUrl}:${avatarImage.retryCount}`}
                      source={{ uri: avatarImage.imageUri }}
                      style={styles.avatarImage}
                      onError={avatarImage.onError}
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: tokens.inputBg }]}>
                      <Text style={[styles.avatarText, { color: tokens.textMuted }]}>{initial(profile.name)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.heroBody}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: tokens.text }]}>{profile.name}</Text>
                    {hasVerifiedBadge ? (
                      <View style={styles.verifiedBadge}>
                        <VerificationIcon color={tokens.textMuted} />
                      </View>
                    ) : null}
                  </View>
                  {companyLabel ? <Text style={[styles.verifiedCompany, { color: tokens.textMuted }]}>{companyLabel}</Text> : null}
                  {profile.username ? <Text style={[styles.meta, { color: tokens.textMuted }]}>{`@${profile.username}`}</Text> : null}
                  <Text style={[styles.slug, { color: tokens.textMuted }]}>
                    <Text style={styles.slugStrong}>{formatSlug(profile.slug)}</Text>
                  </Text>
                  {residentSlugs.length > 1 ? (
                    <View style={styles.slugList}>
                      {residentSlugs.map((value) => {
                        const active = value === profile.slug;
                        return (
                          <View
                            key={`locked-slug-${value}`}
                            style={[
                            styles.slugListChip,
                            {
                              borderColor: active ? tokens.accent : tokens.border,
                              backgroundColor: active ? tokens.surface : tokens.inputBg,
                            },
                          ]}
                        >
                          {active ? <Check size={12} strokeWidth={2} color={tokens.accent} /> : null}
                          <Text style={[styles.slugListChipText, { color: active ? tokens.accent : tokens.textMuted }]}>
                            {formatSlug(value)}
                          </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={[styles.lockCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                <View style={[styles.lockIconWrap, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}>
                  <Lock size={22} strokeWidth={1.8} color={tokens.text} />
                </View>
                <Text style={[styles.lockTitle, { color: tokens.text }]}>{profileText.privateTitle}</Text>
                <Text style={[styles.lockSubtitle, { color: tokens.textMuted }]}>{profileText.privateSubtitle}</Text>
                <Animated.View style={[styles.lockInputWrap, lockShakeStyle]}>
                  <TextInput
                    value={privatePassword}
                    secureTextEntry
                    autoCapitalize='none'
                    autoCorrect={false}
                    placeholder={profileText.privatePlaceholder}
                    placeholderTextColor={tokens.textMuted}
                    onChangeText={setPrivatePassword}
                    style={[styles.lockInput, { borderColor: tokens.border, backgroundColor: tokens.inputBg, color: tokens.text }]}
                  />
                </Animated.View>
                {privateError ? <Text style={[styles.lockError, { color: tokens.red }]}>{privateError}</Text> : null}
                <AnimatedPressable
                  style={[
                    styles.lockButton,
                    {
                      backgroundColor: tokens.text,
                      opacity: unlockMutation.isPending ? 0.7 : 1,
                    },
                  ]}
                  disabled={unlockMutation.isPending}
                  onPress={handleUnlockPrivateProfile}
                >
                  {unlockMutation.isPending ? (
                    <ActivityIndicator size='small' color={tokens.phoneBg} />
                  ) : (
                    <Text style={[styles.lockButtonText, { color: tokens.phoneBg }]}>{profileText.privateUnlock}</Text>
                  )}
                </AnimatedPressable>
              </View>
            </ScrollView>
          </ScreenTransition>
        </AppShell>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell title={profileText.title} tokens={tokens}>
        <ScreenTransition>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={profileQuery.isRefetching}
                onRefresh={() => void onRefresh()}
                tintColor={tokens.accent}
                colors={[tokens.accent]}
              />
            }
          >
            <View style={styles.slugLookupWrap}>
              <View style={styles.slugLookupTopRow}>
                <AnimatedPressable
                  style={[styles.backButton, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
                  onPress={() => router.back()}
                >
                  <ChevronLeft size={16} color={tokens.text} strokeWidth={1.8} />
                  <Text style={[styles.backButtonText, { color: tokens.text }]}>{profileText.back}</Text>
                </AnimatedPressable>
                <View style={[styles.slugSearchBox, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  <Text style={[styles.slugPrefix, { color: tokens.textMuted }]}>unqx.uz/</Text>
                  <TextInput
                    value={searchSlugValue}
                    onChangeText={handleSearchSlugChange}
                    placeholder={profileText.searchSlug}
                    placeholderTextColor={tokens.textMuted}
                    autoCapitalize='characters'
                    autoCorrect={false}
                    style={[styles.slugSearchInput, { color: tokens.text }]}
                  />
                </View>
                <AnimatedPressable
                  style={[styles.slugSearchAction, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
                  onPress={() => {
                    void handleLookupSlug();
                  }}
                >
                  {lookupPending ? (
                    <ActivityIndicator size='small' color={tokens.text} />
                  ) : (
                    <Search size={16} color={tokens.text} strokeWidth={1.8} />
                  )}
                </AnimatedPressable>
              </View>
              {lookupResult ? (
                <View style={[styles.lookupResultCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  {lookupResult.available ? (
                    <>
                      <View style={styles.lookupResultInfo}>
                        <Text style={[styles.lookupSlug, { color: tokens.text }]}>{lookupResult.slug}</Text>
                        <Text style={[styles.lookupStatus, { color: tokens.textMuted }]}>{profileText.slugAvailable}</Text>
                      </View>
                      <View style={styles.lookupResultRight}>
                        <Text style={[styles.lookupPrice, { color: tokens.text }]}>{lookupPriceText}</Text>
                        <AnimatedPressable
                          style={[styles.buyButton, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}
                          onPress={() => {
                            void handleBuySlug();
                          }}
                        >
                          <Text style={[styles.buyButtonText, { color: tokens.text }]}>{profileText.buySlug}</Text>
                        </AnimatedPressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.lookupAvatarWrap}>
                        {lookupAvatar.showImage && lookupAvatar.imageUri ? (
                          <Image
                            key={`${lookupResult.profile?.avatarUrl}:${lookupAvatar.retryCount}`}
                            source={{ uri: lookupAvatar.imageUri }}
                            style={styles.lookupAvatar}
                            onError={lookupAvatar.onError}
                          />
                        ) : (
                          <View style={[styles.lookupAvatar, { backgroundColor: tokens.inputBg }]}>
                            <Text style={[styles.lookupAvatarText, { color: tokens.textMuted }]}>
                              {initial(lookupResult.profile?.name ?? lookupResult.slug)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.lookupResultInfo}>
                        <Text style={[styles.lookupSlug, { color: tokens.text }]}>{lookupResult.slug}</Text>
                        <Text style={[styles.lookupName, { color: tokens.textSub }]}>
                          {lookupResult.profile?.name || profileText.slugTaken}
                        </Text>
                      </View>
                      <View style={styles.lookupResultRight}>
                        <Text style={[styles.lookupPrice, { color: tokens.text }]}>{lookupPriceText}</Text>
                      </View>
                    </>
                  )}
                </View>
              ) : null}
            </View>

            <View style={[styles.headerCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
              <LinearGradient
                colors={[tokens.surface, tokens.inputBg]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
              />
              <View style={[styles.headerAvatarWrap, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}>
                {avatarImage.showImage && avatarImage.imageUri ? (
                  <Image
                    key={`${profile.avatarUrl}:${avatarImage.retryCount}`}
                    source={{ uri: avatarImage.imageUri }}
                    style={styles.headerAvatarImage}
                    onError={avatarImage.onError}
                  />
                ) : (
                  <View style={[styles.headerAvatarFallback, { backgroundColor: tokens.phoneBg }]}>
                    <Text style={[styles.headerAvatarText, { color: tokens.textMuted }]}>{initial(profile.name)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerBlock}>
                <Text style={[styles.fullName, { color: tokens.text }]}>{profile.name}</Text>
                {companyLabel || hasVerifiedBadge ? (
                  <View style={styles.companyRow}>
                    {companyLabel ? <Text style={[styles.companyText, { color: tokens.textSub }]}>{companyLabel}</Text> : null}
                    {hasVerifiedBadge ? (
                      <View style={styles.verifiedBadge}>
                        <VerificationIcon color={tokens.textMuted} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {profile.role ? <Text style={[styles.roleLine, { color: tokens.textMuted }]}>{profile.role}</Text> : null}
                {profile.bio ? <Text style={[styles.bioLine, { color: tokens.textMuted }]}>{profile.bio}</Text> : null}
                {profileTags.length > 0 ? (
                  <View style={styles.tagInlineRow}>
                    {profileTags.map((tag, index) => (
                      <Text key={`${tag}-${index}`} style={[styles.tagInlineText, { color: tokens.textMuted }]}>
                        {tag}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <View style={styles.badgesRow}>
                  {resolvedLeaderboardPosition !== null && resolvedLeaderboardPosition > 0 ? (
                    <View style={[styles.badgeChip, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}>
                      <Text style={[styles.badgeChipText, { color: tokens.textMuted }]}>
                        {`${profileText.badgeLeaderboard} #${Math.round(resolvedLeaderboardPosition)}`}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.badgeChip, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}>
                    <Text style={[styles.badgeChipText, { color: tokens.textMuted }]}>{`${profileText.badgePlan} ${planLabel}`}</Text>
                  </View>
                </View>

                {totalPriceValue !== '—' ? (
                  <Text style={[styles.planPriceLine, { color: tokens.textMuted }]}>
                    {totalPriceValue}
                  </Text>
                ) : null}

                {residentSlugs.length > 0 ? (
                  <View style={styles.headerSlugsBlock}>
                    <View style={styles.headerSlugsList}>
                      {residentSlugs.map((value) => {
                        const isActiveSlug = value === profile.slug;
                        return (
                          <View
                            key={`header-slug-${value}`}
                            style={[
                              styles.headerSlugChip,
                              {
                                borderColor: isActiveSlug ? tokens.accent : tokens.border,
                                backgroundColor: tokens.inputBg,
                              },
                            ]}
                          >
                            <Text style={[styles.headerSlugChipText, { color: isActiveSlug ? tokens.text : tokens.textMuted }]}>
                              {formatSlug(value)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.metricsStrip,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.border,
                },
              ]}
            >
              <View style={styles.metricCell}>
                <Text style={[styles.metricValue, { color: tokens.text }]}>{formatCompact(viewsValue, locale)}</Text>
                <Text style={[styles.metricLabel, { color: tokens.textMuted }]}>{profileText.views}</Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: tokens.border }]} />
              <View style={styles.metricCell}>
                <Text style={[styles.metricValue, { color: tokens.text }]}>{scoreMetricValue}</Text>
                <Text style={[styles.metricLabel, { color: tokens.textMuted }]}>{profileText.badgeScore}</Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: tokens.border }]} />
              <View style={styles.metricCell}>
                <Text style={[styles.metricValue, { color: tokens.text }]}>{ratingValue}</Text>
                <Text style={[styles.metricLabel, { color: tokens.textMuted }]}>{profileText.rating}</Text>
              </View>
            </View>

            {links.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>{profileText.links}</Text>
                <View style={styles.linksStack}>
                  {links.map((button, index) => {
                    const iconKey = inferButtonIcon({ label: button.label, url: button.url, currentIcon: button.icon });
                    const Icon = findButtonIcon(iconKey).Icon;
                    return (
                      <Animated.View
                        key={`${button.label}-${button.url}-${index}`}
                        entering={FadeInDown.duration(180).delay(index * 35)}
                      >
                        <AnimatedPressable
                          style={[styles.linkButton, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
                          onPress={() => {
                            void handleOpenButtonUrl(button);
                          }}
                        >
                          <View style={styles.linkIconSlot}>
                            <Icon size={16} strokeWidth={1.7} color={tokens.textMuted} />
                          </View>
                          <View style={styles.linkLabelSlot}>
                            <Text style={[styles.linkButtonLabel, { color: tokens.textMuted }]}>{button.label}</Text>
                          </View>
                          <View style={styles.linkIconSlot} />
                        </AnimatedPressable>
                      </Animated.View>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>{profileText.actions}</Text>
            <View style={styles.actionGrid}>
              <AnimatedPressable
                containerStyle={styles.actionCell}
                style={[styles.actionButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={handleExportProfileVcf}
              >
                <Download size={16} strokeWidth={1.8} color={tokens.textMuted} />
                <Text style={[styles.actionText, { color: tokens.text }]}>{profileText.saveVcf}</Text>
              </AnimatedPressable>

              <AnimatedPressable
                containerStyle={styles.actionCell}
                style={[styles.actionButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={handleOpenCard}
              >
                <Globe size={16} strokeWidth={1.6} color={tokens.textMuted} />
                <Text style={[styles.actionText, { color: tokens.text }]}>{profileText.openCard}</Text>
              </AnimatedPressable>

              <AnimatedPressable
                containerStyle={styles.actionCell}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                    opacity: saveMutation.isPending ? 0.6 : 1,
                  },
                ]}
                disabled={saveMutation.isPending}
                onPress={handleToggleSaved}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size='small' color={tokens.textMuted} />
                ) : (
                  <>
                    <Star
                      size={16}
                      strokeWidth={1.6}
                      color={profile.saved ? tokens.amber : tokens.textMuted}
                      fill={profile.saved ? tokens.amber : 'none'}
                    />
                    <Text style={[styles.actionText, { color: profile.saved ? tokens.amber : tokens.text }]}>
                      {profile.saved ? profileText.inFavorites : profileText.toFavorites}
                    </Text>
                  </>
                )}
              </AnimatedPressable>

              <AnimatedPressable
                containerStyle={styles.actionCell}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                    opacity: subscribeMutation.isPending ? 0.6 : 1,
                  },
                ]}
                disabled={subscribeMutation.isPending}
                onPress={handleToggleContact}
              >
                {subscribeMutation.isPending ? (
                  <ActivityIndicator size='small' color={tokens.textMuted} />
                ) : (
                  <>
                    {profile.subscribed ? (
                      <UserCheck size={16} strokeWidth={1.6} color={tokens.green} />
                    ) : (
                      <UserPlus size={16} strokeWidth={1.6} color={tokens.textMuted} />
                    )}
                    <Text style={[styles.actionText, { color: profile.subscribed ? tokens.green : tokens.text }]}>
                      {profile.subscribed ? profileText.inContacts : profileText.toContacts}
                    </Text>
                  </>
                )}
              </AnimatedPressable>
            </View>

            {hasContacts ? (
              <>
                <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>{profileText.contacts}</Text>
                <View style={[styles.contactCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                  {contactRows.map((row, index) => {
                    const Icon = row.icon;
                    return (
                      <View
                        key={row.key}
                        style={[
                          styles.contactRow,
                          index < contactRows.length - 1
                            ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.border }
                            : null,
                        ]}
                      >
                        <View style={[styles.contactIconWrap, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}>
                          <Icon size={15} strokeWidth={1.6} color={tokens.textMuted} />
                        </View>
                        <View style={styles.contactContent}>
                          <Text style={[styles.contactLabel, { color: tokens.textMuted }]}>{row.label}</Text>
                          <Text style={[styles.contactValue, { color: tokens.text }]}>{row.value}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {shouldShowCenterHashtag ? <Text style={[styles.centerHashtag, { color: tokens.textMuted }]}>{normalizedProfileHashtag}</Text> : null}

            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: tokens.textMuted }]}>{footerViewsText}</Text>
              <Text style={[styles.footerText, { color: tokens.textMuted }]}>UNQX</Text>
            </View>
          </ScrollView>
        </ScreenTransition>
      </AppShell>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
  skeletonPills: {
    flexDirection: 'row',
    gap: 6,
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: 10,
  },
  skeletonAction: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 28,
    gap: 12,
  },
  slugLookupWrap: {
    marginTop: 12,
    gap: 8,
  },
  slugLookupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
  backButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  slugSearchBox: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slugPrefix: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  slugSearchInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    paddingVertical: 0,
  },
  slugSearchAction: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupResultCard: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lookupAvatarWrap: {
    width: 34,
    height: 34,
  },
  lookupAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  lookupResultInfo: {
    flex: 1,
    gap: 2,
  },
  lookupSlug: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  lookupName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  lookupStatus: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  lookupResultRight: {
    minWidth: 90,
    alignItems: 'flex-end',
    gap: 6,
  },
  lookupPrice: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
  },
  buyButton: {
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  coverWrap: {
    marginHorizontal: -20,
    height: 164,
    overflow: 'hidden',
  },
  coverGradient: {
    flex: 1,
  },
  avatarFloatWrap: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 5,
    marginTop: -54,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFloatImage: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  avatarFloatFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFloatText: {
    fontSize: 34,
    fontFamily: 'Inter_600SemiBold',
  },
  headerBlock: {
    alignItems: 'center',
    paddingTop: 6,
    paddingHorizontal: 2,
    gap: 6,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerAvatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignSelf: 'center',
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  headerAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 30,
    fontFamily: 'Inter_600SemiBold',
  },
  fullName: {
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'Inter_600SemiBold',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  companyText: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleLine: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  bioLine: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  tagInlineRow: {
    marginTop: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tagInlineText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  slugKicker: {
    marginTop: 4,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: 'Inter_500Medium',
  },
  badgesRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  planPriceLine: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  headerSlugsBlock: {
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  headerSlugsLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontFamily: 'Inter_600SemiBold',
  },
  headerSlugsList: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  headerSlugChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  headerSlugChipText: {
    fontSize: 11,
    letterSpacing: 0.2,
    fontFamily: 'Inter_500Medium',
  },
  badgeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeChipText: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_600SemiBold',
  },
  metricsStrip: {
    marginHorizontal: 0,
    marginTop: 10,
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  metricValue: {
    fontSize: 20,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  metricLabel: {
    fontSize: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'Inter_500Medium',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    marginTop: 10,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    fontFamily: 'Inter_600SemiBold',
  },
  linksStack: {
    gap: 10,
  },
  linkButton: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIconSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabelSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  linkButtonLabel: {
    textAlign: 'center',
    fontSize: 14,
    flexShrink: 1,
    fontFamily: 'Inter_500Medium',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  actionCell: {
    width: '48%',
  },
  actionButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionText: {
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
    fontFamily: 'Inter_500Medium',
  },
  contactCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  contactIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactContent: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_500Medium',
  },
  contactValue: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  centerHashtag: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  scoreCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  scoreTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  scoreLeft: {
    flex: 1,
    gap: 4,
  },
  scoreRight: {
    minWidth: 92,
    alignItems: 'flex-end',
    gap: 4,
  },
  scoreKicker: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'Inter_600SemiBold',
  },
  scoreNumber: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'Inter_600SemiBold',
  },
  scorePercent: {
    fontSize: 16,
    textAlign: 'right',
    fontFamily: 'Inter_600SemiBold',
  },
  scoreRarity: {
    fontSize: 11,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_500Medium',
  },
  scoreTrack: {
    height: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 999,
  },
  footerRow: {
    marginTop: 8,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'Inter_500Medium',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 14,
  },
  brandingRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandName: {
    fontSize: 13,
    letterSpacing: 1.8,
    fontFamily: 'Inter_600SemiBold',
  },
  brandPowered: {
    fontSize: 10,
    letterSpacing: 0.9,
    fontFamily: 'Inter_500Medium',
  },
  heroAvatarWrap: {
    width: '100%',
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarText: {
    fontSize: 30,
    fontFamily: 'Inter_600SemiBold',
  },
  heroBody: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
  },
  name: {
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
  },
  nameRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  verifiedCompany: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.2,
  },
  roleText: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  slug: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  slugStrong: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.1,
  },
  slugList: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  slugListChip: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 24,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slugListChipText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.2,
  },
  meta: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  lockCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  lockIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  lockInputWrap: {
    width: '100%',
    marginTop: 4,
  },
  lockInput: {
    width: '100%',
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  lockError: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  lockButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  lockButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
