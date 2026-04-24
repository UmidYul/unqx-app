import React from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart2, PenLine, TrendingUp, Wifi } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppShell } from '@/components/AppShell';
import { withProtectedTab } from '@/components/auth/withProtectedTab';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { QRCodeModal } from '@/components/QRCodeModal';
import { ScreenTransition } from '@/components/ScreenTransition';
import { ShareSheet } from '@/components/ShareSheet';
import { SkeletonBlock, SkeletonCard, SkeletonCircle } from '@/components/ui/skeleton';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Chevron, Label, Pill } from '@/components/ui/shared';
import { MESSAGES } from '@/constants/messages';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';
import { updateWidgetTapStats } from '@/lib/widgetStats';
import {
  fetchAnalyticsDashboardLike,
  fetchContactsLike,
  fetchCurrentUserLike,
  fetchHomeRecentLike,
  fetchHomeSummaryLike,
} from '@/services/mobileApi';
import { AnalyticsSummary, HomeUser, RecentTap } from '@/types';
import { useThemeContext } from '@/theme/ThemeProvider';
import { formatSlug } from '@/utils/avatar';
import { toast } from '@/utils/toast';
import { uniqueBy } from '@/utils/uniqueBy';

interface HomePayload {
  user: HomeUser;
  summary: AnalyticsSummary;
  recent: RecentTap[];
}

function normalizeOwnedSlug(value: unknown): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}\d{3}$/.test(normalized) ? normalized : '';
}

function resolvePrimarySlug(payload: { user?: any; slugs?: any[]; selectedSlug?: string }, source: any): string {
  const slugs = Array.isArray(payload?.slugs) ? payload.slugs : Array.isArray(source?.slugs) ? source.slugs : [];
  const primary = slugs.find((item: any) => item?.isPrimary);
  const candidates = [
    primary?.fullSlug,
    primary?.slug,
    slugs[0]?.fullSlug,
    slugs[0]?.slug,
    payload?.selectedSlug,
    source?.selectedSlug,
  ];

  for (const value of candidates) {
    const slug = normalizeOwnedSlug(value);
    if (slug) {
      return slug;
    }
  }

  return '';
}

function parseUser(raw: unknown): HomeUser {
  const payload = raw as { user?: any; slugs?: any[]; selectedSlug?: string };
  const source = payload?.user ?? payload;
  const normalizedPlan = String(source?.effectivePlan ?? source?.plan ?? 'none').trim().toLowerCase();
  const plan = normalizedPlan === 'premium' || normalizedPlan === 'basic' || normalizedPlan === 'none'
    ? normalizedPlan
    : 'none';
  return {
    id: source?.id,
    name: source?.name ?? source?.displayName ?? source?.firstName ?? 'UNQX User',
    slug: resolvePrimarySlug(payload, source),
    plan,
  };
}

function parseSummary(raw: unknown): AnalyticsSummary {
  const source = (raw as { summary?: any })?.summary ?? raw;
  return {
    totalTaps: Number(source?.totalTaps ?? source?.total ?? 0),
    todayTaps: Number(source?.todayTaps ?? source?.today ?? 0),
    growth: Number(source?.growth ?? 0),
    weekTaps: Array.isArray(source?.weekTaps) ? source.weekTaps.map((v: unknown) => Number(v || 0)) : [],
  };
}

function parseRecent(raw: unknown): RecentTap[] {
  const source = (raw as { items?: any[]; recent?: any[] })?.items ?? (raw as { recent?: any[] })?.recent ?? raw;

  if (!Array.isArray(source)) {
    return [];
  }

  return source.slice(0, 4).map((item: any, index: number) => ({
    id: String(item?.id ?? `${index}`),
    name: item?.name ?? item?.ownerName ?? item?.viewerName ?? item?.slug ?? 'Unknown',
    slug: item?.slug ?? item?.fullSlug ?? item?.viewerSlug ?? item?.visitorSlug ?? item?.ownerSlug ?? undefined,
    time: item?.time ?? item?.timestamp ?? item?.createdAt ?? 'just now',
    source: item?.source ?? item?.channel ?? item?.slug ?? item?.visitorSlug ?? 'direct',
  }));
}

function normalizeRecentSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

function initialLetter(name: string): string {
  return (name || 'U').trim().charAt(0).toUpperCase();
}

function toAgoLabel(raw: string, isUz: boolean): string {
  if (!raw) return isUz ? 'hozirgina' : 'только что';
  if (raw.includes('назад') || raw.includes('сегодня') || raw.includes('вчера') || raw.includes('oldin') || raw.includes('bugun') || raw.includes('kecha')) return raw;

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return raw;
  }

  const diffMs = Math.max(0, Date.now() - parsed);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return isUz ? 'hozirgina' : 'только что';
  if (diffMin < 60) return isUz ? `${diffMin} daqiqa oldin` : `${diffMin} мин назад`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return isUz ? `${diffHours} soat oldin` : `${diffHours} ч назад`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return isUz ? `${diffDays} kun oldin` : `${diffDays} д назад`;

  return new Date(parsed).toLocaleDateString(isUz ? 'uz-UZ' : 'ru-RU');
}

function sourceLabel(value: string | undefined, isUz: boolean): string {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('nfc')) return 'NFC';
  if (lower.includes('qr')) return 'QR';
  if (lower.includes('share') || lower.includes('telegram')) return 'Share';
  if (lower.includes('widget')) return 'Widget';
  return isUz ? "To'g'ridan-to'g'ri" : 'Прямая';
}

function HomePage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const { tokens } = useThemeContext();
  const { safePush } = useThrottledNavigation();
  const { language } = useLanguageContext();
  const isUz = language === 'uz';

  const homeText = isUz
    ? {
      unknownName: 'Noma\'lum',
      justNow: 'hozirgina',
      growthSuffix: 'oldingi davrga nisbatan',
      retry: 'Qayta urinish',
      premium: 'Premium',
      basic: 'Asosiy',
      noPlan: 'Tarif tanlanmagan',
      slugNotSelected: 'SLUG tanlanmagan',
      activationRequiredTitle: 'SLUG va tarif kerak',
      activationRequiredSub: 'QR va ulashish uchun avval SLUG egallab tarifni faollashtiring',
      share: 'Ulashish',
      showQr: 'QR ko\'rsatish',
      today: 'Bugun',
      realtime: 'real vaqtda yangilanadi',
      totalTaps: 'Jami taplar',
      noEvents: 'Hozircha hodisalar yo\'q',
    }
    : {
      unknownName: 'Неизвестный',
      justNow: 'только что',
      growthSuffix: 'к прошлому периоду',
      retry: 'Повторить',
      premium: 'Премиум',
      basic: 'Базовый',
      noPlan: 'Тариф не выбран',
      slugNotSelected: 'Slug не выбран',
      activationRequiredTitle: 'Нужны slug и тариф',
      activationRequiredSub: 'Чтобы открыть QR и поделиться визиткой, сначала купите slug и активируйте тариф',
      share: 'Поделиться',
      showQr: 'Показать QR',
      today: 'Сегодня',
      realtime: 'обновляется в реальном времени',
      totalTaps: 'Всего тапов',
      noEvents: 'Пока нет событий',
    };

  const [shareVisible, setShareVisible] = React.useState(false);
  const [qrVisible, setQrVisible] = React.useState(false);
  const [animatedTotal, setAnimatedTotal] = React.useState(0);

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchCurrentUserLike,
  });

  const analyticsQuery = useQuery({
    queryKey: queryKeys.homeSummary,
    queryFn: fetchHomeSummaryLike,
  });

  const recentQuery = useQuery({
    queryKey: queryKeys.homeRecent,
    queryFn: fetchHomeRecentLike,
  });

  React.useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.analytics,
      queryFn: fetchAnalyticsDashboardLike,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.contacts,
      queryFn: async () => {
        const raw = await fetchContactsLike('');
        const source = (raw as { items?: unknown[]; contacts?: unknown[] })?.items ?? (raw as { contacts?: unknown[] })?.contacts ?? raw;
        return Array.isArray(source) ? source : [];
      },
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.leaderboard,
      queryFn: () => apiClient.getFirst(['/leaderboard']),
    });
  }, [queryClient]);

  const payload = React.useMemo<HomePayload | null>(() => {
    if (!meQuery.data || !analyticsQuery.data || !recentQuery.data) {
      return null;
    }
    return {
      user: parseUser(meQuery.data),
      summary: parseSummary(analyticsQuery.data),
      recent: parseRecent(recentQuery.data),
    };
  }, [analyticsQuery.data, meQuery.data, recentQuery.data]);

  const loading = !payload && (meQuery.isLoading || analyticsQuery.isLoading || recentQuery.isLoading);
  const error = meQuery.error || analyticsQuery.error || recentQuery.error;
  const isRefreshing = meQuery.isRefetching || analyticsQuery.isRefetching || recentQuery.isRefetching;

  const onRefresh = React.useCallback(async () => {
    await Promise.all([meQuery.refetch(), analyticsQuery.refetch(), recentQuery.refetch()]);
  }, [analyticsQuery, meQuery, recentQuery]);

  React.useEffect(() => {
    const target = payload?.summary.totalTaps ?? 0;
    const duration = 900;
    const startAt = Date.now();
    const from = animatedTotal;
    let frameId = 0;

    const tick = () => {
      const progress = Math.min(1, (Date.now() - startAt) / duration);
      const next = Math.round(from + (target - from) * progress);
      setAnimatedTotal(next);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [payload?.summary.totalTaps]);

  React.useEffect(() => {
    if (!payload) {
      return;
    }

    void updateWidgetTapStats(payload.summary.todayTaps ?? 0, payload.summary.totalTaps ?? 0);
  }, [payload]);

  if (loading && !payload) {
    return (
      <AppShell title={MESSAGES.ui.screens.home} tokens={tokens}>
        <View style={styles.skeletonWrap}>
          <SkeletonCard tokens={tokens} style={styles.skeletonHeroCard}>
            <SkeletonBlock tokens={tokens} height={12} width={124} radius={6} />
            <SkeletonBlock tokens={tokens} height={34} width='68%' radius={10} />
            <View style={styles.skeletonPillRow}>
              <SkeletonBlock tokens={tokens} height={34} width='48%' radius={16} />
              <SkeletonBlock tokens={tokens} height={34} width={104} radius={16} />
            </View>
            <SkeletonBlock tokens={tokens} height={11} width={92} radius={6} />
            <View style={styles.skeletonHeroButtons}>
              <SkeletonBlock tokens={tokens} height={54} radius={18} style={styles.skeletonMetric} />
              <SkeletonBlock tokens={tokens} height={54} radius={18} style={styles.skeletonMetric} />
            </View>
          </SkeletonCard>
          <View style={styles.skeletonMetrics}>
            <SkeletonCard tokens={tokens} style={styles.skeletonMetricCard}>
              <SkeletonBlock tokens={tokens} height={12} width='46%' radius={6} />
              <SkeletonBlock tokens={tokens} height={34} width={82} radius={10} />
              <SkeletonBlock tokens={tokens} height={10} width='72%' radius={6} />
              <SkeletonBlock tokens={tokens} height={10} width='58%' radius={6} />
            </SkeletonCard>
            <SkeletonCard tokens={tokens} style={styles.skeletonMetricCard}>
              <SkeletonBlock tokens={tokens} height={12} width='42%' radius={6} />
              <SkeletonBlock tokens={tokens} height={34} width={88} radius={10} />
              <SkeletonBlock tokens={tokens} height={10} width='68%' radius={6} />
              <SkeletonBlock tokens={tokens} height={10} width='54%' radius={6} />
            </SkeletonCard>
          </View>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={`sk-action-${i}`} tokens={tokens} style={styles.skeletonRowCard}>
              <View style={styles.skeletonRow}>
                <SkeletonCircle tokens={tokens} size={40} />
                <View style={styles.skeletonActionText}>
                  <SkeletonBlock tokens={tokens} height={12} width='62%' />
                  <SkeletonBlock tokens={tokens} height={10} width='42%' />
                </View>
              </View>
            </SkeletonCard>
          ))}
          {[0, 1].map((i) => (
            <SkeletonCard key={`sk-recent-${i}`} tokens={tokens} style={styles.skeletonRecentCard}>
              <View style={styles.skeletonRecentRow}>
                <SkeletonCircle tokens={tokens} size={36} />
                <View style={styles.skeletonActionText}>
                  <SkeletonBlock tokens={tokens} height={11} width='52%' />
                  <SkeletonBlock tokens={tokens} height={10} width='38%' />
                </View>
                <SkeletonBlock tokens={tokens} height={10} width={54} />
              </View>
            </SkeletonCard>
          ))}
        </View>
      </AppShell>
    );
  }

  if (!payload) {
    return (
      <ErrorBoundary>
        <AppShell title={MESSAGES.ui.screens.home} tokens={tokens}>
          <ErrorState
            tokens={tokens}
            onRetry={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.me });
              void queryClient.invalidateQueries({ queryKey: queryKeys.homeSummary });
              void queryClient.invalidateQueries({ queryKey: queryKeys.homeRecent });
            }}
          />
        </AppShell>
      </ErrorBoundary>
    );
  }

  const user = payload.user;
  const summary = payload.summary;
  const recent = payload.recent;

  const growth = Number(summary.growth ?? 0);
  const growthText = `${growth > 0 ? '+' : ''}${growth}% ${homeText.growthSuffix}`;
  const normalizedPlan = String(user.plan).toLowerCase();
  const isPremium = normalizedPlan === 'premium';
  const hasCardAccess = normalizedPlan === 'basic' || normalizedPlan === 'premium';
  const hasOwnedSlug = Boolean(user.slug);
  const canShareCard = hasCardAccess && hasOwnedSlug;
  const planLabel = isPremium ? homeText.premium : normalizedPlan === 'basic' ? homeText.basic : homeText.noPlan;
  const heroSlug = hasOwnedSlug ? formatSlug(user.slug) : homeText.slugNotSelected;

  const openPricing = async () => {
    try {
      await Linking.openURL('https://unqx.uz/#pricing');
    } catch {
      toast.error(isUz ? 'Havolani ochib bo\'lmadi' : 'Не удалось открыть ссылку');
    }
  };

  const handleRequirePlan = () => {
    toast.error(homeText.activationRequiredTitle, homeText.activationRequiredSub);
    void openPricing();
  };

  const handleOpenQr = () => {
    if (!canShareCard) {
      handleRequirePlan();
      return;
    }
    setQrVisible(true);
  };

  const handleOpenShare = () => {
    if (!canShareCard) {
      handleRequirePlan();
      return;
    }
    setShareVisible(true);
  };

  return (
    <ErrorBoundary>
      <AppShell title={MESSAGES.ui.screens.home} tokens={tokens}>
        <ScreenTransition>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={tokens.accent} colors={[tokens.accent]} />}
          >
            {error ? (
              <View style={[styles.errorCard, { borderColor: tokens.red, backgroundColor: `${tokens.red}12` }]}>
                <Text style={[styles.errorText, { color: tokens.red }]}>{MESSAGES.query.homeCacheUpdateFailed}</Text>
                <AnimatedPressable
                  onPress={() => {
                    void queryClient.invalidateQueries({ queryKey: queryKeys.me });
                    void queryClient.invalidateQueries({ queryKey: queryKeys.homeSummary });
                    void queryClient.invalidateQueries({ queryKey: queryKeys.homeRecent });
                  }}
                >
                  <Text style={[styles.retryText, { color: tokens.text }]}>{homeText.retry}</Text>
                </AnimatedPressable>
              </View>
            ) : null}

            <View style={[styles.hero, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
              <LinearGradient colors={tokens.heroGradient} style={StyleSheet.absoluteFill} />
              <View style={[styles.heroGlow, styles.heroGlowLeft, { backgroundColor: tokens.pageTint }]} />
              <View style={[styles.heroGlow, styles.heroGlowRight, { backgroundColor: `${tokens.accent}10` }]} />
              <Wifi size={120} strokeWidth={1.1} color={tokens.pageTint} style={styles.heroBgIcon} />

              <Text style={[styles.heroKicker, { color: tokens.textMuted }]}>unqx.uz / dashboard</Text>
              <Text style={[styles.heroName, { color: tokens.text }]}>{user.name}</Text>

              <View style={styles.heroMetaRow}>
                <View style={[styles.heroSlugPlate, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}>
                  <Text style={[styles.heroSlugPrefix, { color: tokens.textMuted }]}>unqx.uz/</Text>
                  <Text style={[styles.heroSlugValue, { color: tokens.text }]}>{heroSlug}</Text>
                </View>
                <Pill color={tokens.text} bg={tokens.surfaceMuted}>{planLabel}</Pill>
                <Pill color={tokens.textSub} bg={tokens.surfaceMuted}>NFC ready</Pill>
              </View>

              <View style={styles.heroActions}>
                <AnimatedPressable
                  onPress={handleOpenShare}
                  style={[styles.heroActionBtn, styles.heroActionBtnPrimary, { backgroundColor: tokens.accent, borderColor: tokens.accent }]}
                  containerStyle={styles.heroActionWrap}
                >
                  <Text style={[styles.heroActionText, { color: tokens.accentText }]}>{homeText.share}</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={handleOpenQr}
                  style={[styles.heroActionBtn, styles.heroActionBtnSecondary, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}
                  containerStyle={styles.heroActionWrap}
                >
                  <Text style={[styles.heroActionText, { color: tokens.text }]}>{homeText.showQr}</Text>
                </AnimatedPressable>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                <Label color={tokens.textMuted}>{homeText.today}</Label>
                <Text style={[styles.metricValue, { color: tokens.text }]}>{summary.todayTaps ?? 0}</Text>
                <Text style={[styles.metricSub, { color: tokens.textMuted }]}>{homeText.realtime}</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                <Label color={tokens.textMuted}>{homeText.totalTaps}</Label>
                <Text style={[styles.metricValue, { color: tokens.text }]}>{loading ? '...' : animatedTotal}</Text>
                <View style={styles.growthRow}>
                  <TrendingUp size={12} strokeWidth={1.5} color={growth >= 0 ? tokens.green : tokens.red} />
                  <Text style={[styles.metricSub, { color: growth >= 0 ? tokens.green : tokens.red }]}>{growthText}</Text>
                </View>
              </View>
            </View>

            <Label color={tokens.textMuted}>{MESSAGES.ui.home.quickActions}</Label>
            {[
              { label: MESSAGES.ui.home.actionScan, sub: MESSAGES.ui.home.actionScanSub, icon: <Wifi size={18} strokeWidth={1.5} color={tokens.accent} />, route: '/(tabs)/nfc' },
              { label: MESSAGES.ui.home.actionWrite, sub: MESSAGES.ui.home.actionWriteSub, icon: <PenLine size={18} strokeWidth={1.5} color={tokens.accent} />, route: '/(tabs)/nfc' },
              { label: MESSAGES.ui.home.actionAnalytics, sub: MESSAGES.ui.home.actionAnalyticsSub, icon: <BarChart2 size={18} strokeWidth={1.5} color={tokens.accent} />, route: '/(tabs)/analytics' },
            ].map((item) => (
              <AnimatedPressable
                key={item.label}
                onPress={() => safePush(item.route)}
                style={[styles.actionRow, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${tokens.accent}14` }]}>{item.icon}</View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: tokens.text }]}>{item.label}</Text>
                  <Text style={[styles.actionSub, { color: tokens.textMuted }]}>{item.sub}</Text>
                </View>
                <Chevron color={tokens.textMuted} />
              </AnimatedPressable>
            ))}

            <Label color={tokens.textMuted}>{MESSAGES.ui.home.recentTaps}</Label>
            {recent.length === 0 ? <Text style={[styles.recentEmpty, { color: tokens.textMuted }]}>{homeText.noEvents}</Text> : null}
            {uniqueBy(recent, r => normalizeRecentSlug(r.slug) || r.id).map((item, index, arr) => {
              const normalizedSlug = normalizeRecentSlug(item.slug);
              const isUnknown = item.name.trim().toLowerCase() === homeText.unknownName.trim().toLowerCase();
              const isClickable = Boolean(normalizedSlug) && !isUnknown;

              return (
                <Animated.View key={item.id} entering={FadeInDown.duration(220).delay(index * 50)}>
                  <AnimatedPressable
                    onPress={isClickable ? () => safePush(`/(tabs)/people/${normalizedSlug}`) : undefined}
                    disabled={!isClickable}
                    style={[
                      styles.recentRow,
                      {
                        borderBottomColor: tokens.border,
                        borderBottomWidth: index === arr.length - 1 ? 0 : StyleSheet.hairlineWidth,
                        opacity: isClickable ? 1 : 0.9,
                      },
                    ]}
                  >
                    <View style={styles.recentLeft}>
                      <View style={[styles.avatar, { backgroundColor: `${tokens.accent}14` }]}> 
                        <Text style={[styles.avatarText, { color: tokens.text }]}>{initialLetter(item.name)}</Text>
                      </View>
                      <View>
                        <Text style={[styles.recentName, { color: tokens.text }]}>{item.name}</Text>
                        <Text style={[styles.recentSlug, { color: tokens.textMuted }]}>{sourceLabel(item.source, isUz)}</Text>
                      </View>
                    </View>
                    <View style={styles.recentRight}>
                      <Pill color={tokens.accent} bg={`${tokens.accent}14`}>
                        {sourceLabel(item.source, isUz)}
                      </Pill>
                      <Text style={[styles.recentTime, { color: tokens.textMuted }]}>{toAgoLabel(item.time, isUz)}</Text>
                    </View>
                  </AnimatedPressable>
                </Animated.View>
              );
            })}
          </ScrollView>
        </ScreenTransition>

        <QRCodeModal visible={qrVisible && canShareCard} onClose={() => setQrVisible(false)} tokens={tokens} slug={user.slug} />
        <ShareSheet visible={shareVisible && canShareCard} onClose={() => setShareVisible(false)} tokens={tokens} slug={user.slug} name={user.name} />
      </AppShell>
    </ErrorBoundary>
  );
}

export default withProtectedTab(HomePage);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  retryText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  skeletonWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
  },
  skeletonHeroCard: {
    gap: 14,
    minHeight: 220,
  },
  skeletonPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skeletonHeroButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonMetric: {
    flex: 1,
  },
  skeletonMetricCard: {
    flex: 1,
    minHeight: 120,
    gap: 10,
  },
  skeletonRowCard: {
    minHeight: 84,
    justifyContent: 'center',
  },
  skeletonRow: {
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonActionText: {
    flex: 1,
    gap: 8,
  },
  skeletonRecentCard: {
    minHeight: 72,
    justifyContent: 'center',
  },
  skeletonRecentRow: {
    minHeight: 56,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    overflow: 'hidden',
    position: 'relative',
    gap: 12,
  },
  heroBgIcon: {
    position: 'absolute',
    right: -18,
    top: -16,
  },
  heroKicker: {
    fontSize: 11,
    letterSpacing: 0.3,
    fontFamily: 'Inter_500Medium',
  },
  heroName: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'Inter_600SemiBold',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  heroSlugPlate: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroSlugPrefix: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  heroSlugValue: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 1.4,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  heroActionWrap: {
    flex: 1,
  },
  heroActionBtn: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionBtnPrimary: {
    shadowColor: '#111111',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroActionBtnSecondary: {
    shadowColor: '#111111',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  heroActionText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.65,
  },
  heroGlowLeft: {
    left: -70,
    top: -90,
  },
  heroGlowRight: {
    right: -72,
    bottom: -82,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    position: 'relative',
  },
  metricValue: {
    marginTop: 8,
    fontSize: 36,
    lineHeight: 38,
    fontFamily: 'Inter_600SemiBold',
  },
  growthRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricSub: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  recentRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffffff',
  },
  recentName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  recentSlug: {
    marginTop: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  recentTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  recentEmpty: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
