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
import { CheckCircle2, Globe, Hash, Lock, Mail, MapPin, Phone, Star, UserCheck, UserPlus } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { ScreenTransition } from '@/components/ScreenTransition';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCircle } from '@/components/ui/skeleton';
import { Label, Pill } from '@/components/ui/shared';
import { MESSAGES } from '@/constants/messages';
import { useExport } from '@/hooks/useExport';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
import { queryKeys } from '@/lib/queryKeys';
import { ApiError } from '@/lib/apiClient';
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

export default function ResidentProfilePage(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();
  const isUz = language === 'uz';
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
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
      views: 'ko\'rishlar',
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
      views: 'просмотров',
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
    await profileQuery.refetch();
  }, [profileQuery]);

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
                    <View style={[styles.avatar, { backgroundColor: `${tokens.accent}1F` }]}>
                      <Text style={[styles.avatarText, { color: tokens.accent }]}>{initial(profile.name)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.heroBody}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: tokens.text }]}>{profile.name}</Text>
                    {hasVerifiedBadge ? <CheckCircle2 size={16} strokeWidth={1.8} color={tokens.textMuted} /> : null}
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
                                borderColor: active ? `${tokens.accent}88` : tokens.border,
                                backgroundColor: active ? `${tokens.accent}16` : tokens.inputBg,
                              },
                            ]}
                          >
                            {active ? <CheckCircle2 size={12} strokeWidth={2} color={tokens.accent} /> : null}
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
                <View style={[styles.lockIconWrap, { borderColor: tokens.border, backgroundColor: `${tokens.accent}12` }]}>
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
            refreshControl={
              <RefreshControl
                refreshing={profileQuery.isRefetching}
                onRefresh={() => void onRefresh()}
                tintColor={tokens.accent}
                colors={[tokens.accent]}
              />
            }
          >
            <View style={[styles.heroCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              <View style={styles.brandingRow}>
                <Text style={[styles.brandName, { color: tokens.text }]}>UNQX</Text>
                <Text style={[styles.brandPowered, { color: tokens.textMuted }]}>POWERED BY SCXR</Text>
              </View>
              <View style={styles.heroAvatarWrap}>
                {avatarImage.showImage && avatarImage.imageUri ? (
                  <Image
                    key={`${profile.avatarUrl}:${avatarImage.retryCount}`}
                    source={{ uri: avatarImage.imageUri }}
                    style={styles.avatarImage}
                    onError={avatarImage.onError}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: `${tokens.accent}1F` }]}>
                    <Text style={[styles.avatarText, { color: tokens.accent }]}>{initial(profile.name)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.heroBody}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: tokens.text }]}>{profile.name}</Text>
                  {hasVerifiedBadge ? <CheckCircle2 size={16} strokeWidth={1.8} color={tokens.textMuted} /> : null}
                </View>
                {companyLabel ? <Text style={[styles.verifiedCompany, { color: tokens.textMuted }]}>{companyLabel}</Text> : null}
                {profile.role ? <Text style={[styles.roleText, { color: tokens.text }]}>{profile.role}</Text> : null}
                <Text style={[styles.slug, { color: tokens.textMuted }]}>
                  <Text style={styles.slugStrong}>{formatSlug(profile.slug)}</Text>
                </Text>
                {residentSlugs.length > 1 ? (
                  <View style={styles.slugList}>
                    {residentSlugs.map((value) => {
                      const active = value === profile.slug;
                      return (
                        <View
                          key={`slug-${value}`}
                          style={[
                            styles.slugListChip,
                            {
                              borderColor: active ? `${tokens.accent}88` : tokens.border,
                              backgroundColor: active ? `${tokens.accent}16` : tokens.inputBg,
                            },
                          ]}
                        >
                          {active ? <CheckCircle2 size={12} strokeWidth={2} color={tokens.accent} /> : null}
                          <Text style={[styles.slugListChipText, { color: active ? tokens.accent : tokens.textMuted }]}>
                            {formatSlug(value)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                <View style={styles.pillRow}>
                  <Pill
                    color={profile.tag === 'premium' ? tokens.amber : tokens.textMuted}
                    bg={profile.tag === 'premium' ? tokens.amberBg : tokens.inputBg}
                  >
                    {profile.tag === 'premium' ? profileText.premium : profileText.basic}
                  </Pill>
                  <Pill color={tokens.textMuted} bg={tokens.inputBg}>{`${profile.taps ?? 0} ${profileText.taps}`}</Pill>
                </View>
                {profile.city && profile.city !== companyLabel ? <Text style={[styles.meta, { color: tokens.textMuted }]}>{profile.city}</Text> : null}
                {typeof profile.slugPrice === 'number' && Number.isFinite(profile.slugPrice) ? (
                  <View style={styles.hashRow}>
                    <Hash size={13} strokeWidth={1.7} color={tokens.textMuted} />
                    <Text style={[styles.hashText, { color: tokens.textMuted }]}>
                      {`${profileText.slugPrice} ${profile.slugPrice.toLocaleString(isUz ? 'uz-UZ' : 'ru-RU')} сум`}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.heroMetaRow, { borderTopColor: tokens.border }]}>
                <Text style={[styles.heroMetaText, { color: tokens.textMuted }]}>{`© ${profile.taps ?? 0} ${profileText.views} • UNQX`}</Text>
              </View>
            </View>

            {Array.isArray(profile.buttons) && profile.buttons.length > 0 ? (
              <>
                <Label color={tokens.textMuted}>{profileText.links}</Label>
                <View style={styles.linksGrid}>
                  {profile.buttons.map((button, index) => (
                    <Animated.View key={`${button.label}-${button.url}-${index}`} entering={FadeInDown.duration(180).delay(index * 35)} style={styles.linkChipWrap}>
                      <AnimatedPressable
                        style={[styles.linkChip, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
                        onPress={() => {
                          void handleOpenButtonUrl(button);
                        }}
                      >
                        <Text style={[styles.linkChipLabel, { color: tokens.text }]} numberOfLines={1}>{button.label}</Text>
                      </AnimatedPressable>
                    </Animated.View>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.actionRow}>
              <AnimatedPressable
                containerStyle={styles.actionHalf}
                style={[styles.actionButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={handleExportProfileVcf}
              >
                <Text style={[styles.actionText, { color: tokens.text }]}>{profileText.saveVcf}</Text>
              </AnimatedPressable>

              <AnimatedPressable
                containerStyle={styles.actionHalf}
                style={[styles.actionButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={handleOpenCard}
              >
                <Globe size={16} strokeWidth={1.5} color={tokens.text} />
                <Text style={[styles.actionText, { color: tokens.text }]}>{profileText.openCard}</Text>
              </AnimatedPressable>
            </View>

            <View style={styles.actionRow}>
              <AnimatedPressable
                containerStyle={styles.actionHalf}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: profile.saved ? tokens.amberBg : tokens.surface,
                    borderColor: profile.saved ? `${tokens.amber}66` : tokens.border,
                    opacity: saveMutation.isPending ? 0.5 : 1,
                  },
                ]}
                disabled={saveMutation.isPending}
                onPress={handleToggleSaved}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size='small' color={tokens.text} />
                ) : (
                  <>
                    <Star
                      size={16}
                      strokeWidth={1.5}
                      color={profile.saved ? tokens.amber : tokens.text}
                      fill={profile.saved ? tokens.amber : 'none'}
                    />
                    <Text style={[styles.actionText, { color: tokens.text }]}>
                      {profile.saved ? profileText.inFavorites : profileText.toFavorites}
                    </Text>
                  </>
                )}
              </AnimatedPressable>

              <AnimatedPressable
                containerStyle={styles.actionHalf}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: profile.subscribed ? tokens.greenBg : tokens.surface,
                    borderColor: profile.subscribed ? `${tokens.green}66` : tokens.border,
                    opacity: subscribeMutation.isPending ? 0.5 : 1,
                  },
                ]}
                disabled={subscribeMutation.isPending}
                onPress={handleToggleContact}
              >
                {subscribeMutation.isPending ? (
                  <ActivityIndicator size='small' color={tokens.text} />
                ) : (
                  <>
                    {profile.subscribed ? (
                      <UserCheck size={16} strokeWidth={1.5} color={tokens.green} />
                    ) : (
                      <UserPlus size={16} strokeWidth={1.5} color={tokens.text} />
                    )}
                    <Text style={[styles.actionText, { color: tokens.text }]}>
                      {profile.subscribed ? profileText.inContacts : profileText.toContacts}
                    </Text>
                  </>
                )}
              </AnimatedPressable>
            </View>

            <Label color={tokens.textMuted}>{profileText.summary}</Label>
            <View style={[styles.block, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              <Text style={[styles.bio, { color: profile.bio ? tokens.text : tokens.textMuted }]}>
                {profile.bio || profileText.noSummary}
              </Text>
            </View>

            {contactAddress || profile.email || profile.phone ? (
              <>
                <Label color={tokens.textMuted}>{profileText.contacts}</Label>
                <View style={[styles.block, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                  {contactAddress ? (
                    <View style={styles.infoRow}>
                      <MapPin size={14} strokeWidth={1.5} color={tokens.textMuted} />
                      <Text style={[styles.infoText, { color: tokens.text }]}>{contactAddress}</Text>
                    </View>
                  ) : null}
                  {profile.email ? (
                    <View style={styles.infoRow}>
                      <Mail size={14} strokeWidth={1.5} color={tokens.textMuted} />
                      <Text style={[styles.infoText, { color: tokens.text }]}>{profile.email}</Text>
                    </View>
                  ) : null}
                  {profile.phone ? (
                    <View style={styles.infoRow}>
                      <Phone size={14} strokeWidth={1.5} color={tokens.textMuted} />
                      <Text style={[styles.infoText, { color: tokens.text }]}>{profile.phone}</Text>
                    </View>
                  ) : null}
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
    paddingTop: 14,
    paddingBottom: 26,
    gap: 12,
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
  pillRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  meta: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  hashRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hashText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  heroMetaRow: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
    alignItems: 'center',
  },
  heroMetaText: {
    fontSize: 11,
    letterSpacing: 0.3,
    fontFamily: 'Inter_500Medium',
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkChipWrap: {
    maxWidth: '48%',
    minWidth: '31%',
  },
  linkChip: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  linkChipLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionHalf: {
    flex: 1,
  },
  actionButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  primaryAction: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  actionText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  block: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  slugLine: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  bio: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
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
