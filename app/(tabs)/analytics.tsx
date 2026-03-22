import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { ScreenTransition } from '@/components/ScreenTransition';
import { SourceRow } from '@/components/SourceRow';
import { SkeletonBlock } from '@/components/ui/skeleton';
import { Label, Sparkline } from '@/components/ui/shared';
import { MESSAGES } from '@/constants/messages';
import { markPushTrigger } from '@/lib/pushPrompt';
import { queryKeys } from '@/lib/queryKeys';
import { fetchAnalyticsDashboardLike } from '@/services/mobileApi';
import { SourceStat } from '@/types';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { useThemeContext } from '@/theme/ThemeProvider';
import { getUzbekistanWeekday } from '@/theme/tokens';
import { resolveSource } from '@/utils/sourceConfig';
import { uniqueBy } from '@/utils/uniqueBy';

interface AnalyticsPayload {
  totalTaps: number;
  todayTaps: number;
  periodTaps: number;
  periodDays: number;
  growth: number;
  monthTaps: number[];
  weekTaps: number[];
  sources: SourceStat[];
  geo: Array<{ city: string; x: number; y: number; r: number; value?: number }>;
}

interface CityStat {
  city: string;
  taps: number;
  percent: number;
}

function localizeCityName(cityRaw: string, isUz: boolean): string {
  const city = cityRaw.trim();
  if (!isUz) {
    return city;
  }

  const map: Record<string, string> = {
    tashkent: 'Toshkent',
    ташкент: 'Toshkent',
    samarkand: 'Samarqand',
    самарканд: 'Samarqand',
    bukhara: 'Buxoro',
    бухара: 'Buxoro',
    andijan: 'Andijon',
    андижан: 'Andijon',
    fergana: "Farg\'ona",
    фергана: "Farg\'ona",
    namangan: 'Namangan',
    наманган: 'Namangan',
    nukus: 'Nukus',
    нукус: 'Nukus',
    qarshi: 'Qarshi',
    карши: 'Qarshi',
    urgench: 'Urganch',
    ургенч: 'Urganch',
    navoiy: 'Navoiy',
    навои: 'Navoiy',
    jizzakh: 'Jizzax',
    джизак: 'Jizzax',
    gulistan: 'Guliston',
    гулистан: 'Guliston',
    termiz: 'Termiz',
    термез: 'Termiz',
    kokand: "Qo\'qon",
    коканд: "Qo\'qon",
    chirchik: 'Chirchiq',
    чирчик: 'Chirchiq',
    angren: 'Angren',
    ангрен: 'Angren',
    unknown: "Noma\'lum",
    неизвестно: "Noma\'lum",
  };

  return map[city.toLowerCase()] ?? city;
}

function buildCityStats(points: Array<{ city: string; value?: number }>, totalTaps: number): CityStat[] {
  const cityTotals = new Map<string, number>();

  for (const point of points) {
    const city = String(point.city || '').trim();
    if (!city) continue;

    const taps = Number(point.value || 0);
    if (!Number.isFinite(taps) || taps < 1) continue;

    cityTotals.set(city, (cityTotals.get(city) || 0) + taps);
  }

  return [...cityTotals.entries()]
    .map(([city, taps]) => ({
      city,
      taps,
      percent: totalTaps > 0 ? Math.round((taps / totalTaps) * 100) : 0,
    }))
    .filter((item) => item.taps >= 1)
    .sort((a, b) => b.taps - a.taps);
}

function parseSummary(raw: unknown): AnalyticsPayload {
  const source = (raw as { summary?: any })?.summary ?? (raw as any);
  const total = Number(source?.totalTaps ?? source?.total ?? 0);
  const today = Number(source?.todayTaps ?? source?.today ?? 0);
  const periodTaps = Number(source?.periodTaps ?? 0);
  const periodDaysRaw = Number(source?.periodDays ?? source?.period ?? 30);
  const periodDays = Number.isFinite(periodDaysRaw) && periodDaysRaw > 0 ? periodDaysRaw : 30;
  const rawMonth = Array.isArray(source?.monthTaps) ? source.monthTaps : [];
  const rawWeek = Array.isArray(source?.weekTaps) ? source.weekTaps : [];
  const month = rawMonth.map((v: unknown) => Number(v || 0)).slice(-30);
  const week = rawWeek.map((v: unknown) => Number(v || 0)).slice(-7);

  const sourceRows = Array.isArray(source?.sources)
    ? source.sources
    : Object.entries(source?.sources ?? {}).map(([sourceKey, count]) => ({ source: sourceKey, count }));
  const normalizedSources: SourceStat[] = sourceRows
    .map((item: any) => {
      const count = Number(item?.count ?? item?.value ?? 0);
      const percentRaw = Number(item?.percent ?? 0);
      const percent = percentRaw || (total > 0 ? Math.round((count / total) * 100) : 0);
      return {
        source: resolveSource(item?.source ?? item?.label ?? 'direct'),
        count: Number.isFinite(count) ? count : 0,
        percent: Number.isFinite(percent) ? percent : 0,
      };
    })
    .filter((item: SourceStat) => item.count > 0)
    .sort((a: SourceStat, b: SourceStat) => b.count - a.count)
    .slice(0, 5);

  const geoRows = Array.isArray(source?.geo) ? source.geo : [];

  return {
    totalTaps: total,
    todayTaps: Number.isFinite(today) ? today : 0,
    periodTaps: Number.isFinite(periodTaps) && periodTaps >= 0
      ? periodTaps
      : month.reduce((sum: number, value: number) => sum + Number(value || 0), 0),
    periodDays,
    growth: Number(source?.growth ?? 0),
    monthTaps: month.length === 30 ? month : [...Array.from({ length: Math.max(0, 30 - month.length) }, () => 0), ...month],
    weekTaps: week.length === 7 ? week : [...Array.from({ length: Math.max(0, 7 - week.length) }, () => 0), ...week],
    sources: normalizedSources,
    geo: geoRows.map((item: any) => ({
      city: String(item?.city ?? 'Unknown'),
      x: Number(item?.x ?? 178),
      y: Number(item?.y ?? 72),
      r: Number(item?.r ?? 3),
      value: Number(item?.value ?? item?.taps ?? item?.count ?? 0),
    })),
  };
}

function AnimatedBar({
  ratio,
  delay,
  color,
}: {
  ratio: number;
  delay: number;
  color: string;
}): React.JSX.Element {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: progress.value }],
    transformOrigin: 'bottom',
  }));

  return <Animated.View style={[styles.weekBar, { height: `${ratio * 100}%`, backgroundColor: color }, style]} />;
}

export default function AnalyticsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();
  const isUz = language === 'uz';
  const analyticsText = isUz
    ? {
      weekDaysSundayFirst: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sha'],
      retry: 'Qayta urinish',
      tapsByPeriod: 'kunlik taplar',
      totalTaps: 'Umumiy taplar',
      todayTaps: 'Bugun',
      monthGrowth: "o'tgan oyga nisbatan",
      thisWeek: 'Bu hafta',
      cities: 'Shaharlar',
      noCities: "Hozircha tapli shaharlar yo'q",
      sources: 'Manbalar',
      noSources: "Hozircha manbalar bo'yicha ma'lumot yo'q",
    }
    : {
      weekDaysSundayFirst: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
      retry: 'Повторить',
      tapsByPeriod: 'тапов за период',
      totalTaps: 'Общие тапы',
      todayTaps: 'Сегодня',
      monthGrowth: 'к прошлому месяцу',
      thisWeek: 'Эта неделя',
      cities: 'Города',
      noCities: 'Пока нет городов с тапами',
      sources: 'Источники',
      noSources: 'Пока нет данных по источникам',
    };
  const [animatedTotal, setAnimatedTotal] = React.useState(0);
  const query = useQuery({
    queryKey: queryKeys.analytics,
    queryFn: fetchAnalyticsDashboardLike,
  });
  const showInitialSkeleton = query.isLoading && !query.data;
  const isRefreshing = query.isRefetching;
  const onRefresh = React.useCallback(async () => {
    await query.refetch();
  }, [query]);

  React.useEffect(() => {
    void markPushTrigger('analytics').catch(() => undefined);
  }, []);

  const analytics = parseSummary(query.data ?? {});
  const cityStats = React.useMemo(() => uniqueBy(buildCityStats(analytics.geo, analytics.totalTaps), c => c.city.toLowerCase()), [analytics.geo, analytics.totalTaps]);
  const cityMax = React.useMemo(() => Math.max(...cityStats.map((item) => item.taps), 1), [cityStats]);
  const weekMax = Math.max(...analytics.weekTaps, 1);
  const isDark = tokens.text === '#f5f5f5';
  const weekTrackColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,17,17,0.10)';
  const weekBarMutedColor = isDark ? 'rgba(232,223,200,0.42)' : tokens.borderStrong;
  const cityTrackColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(17,17,17,0.12)';
  const cityFillColor = isDark ? 'rgba(232,223,200,0.95)' : tokens.accent;
  const days = React.useMemo(() => {
    const todayDayIndex = getUzbekistanWeekday();
    return Array.from({ length: 7 }, (_, index) => {
      const offset = 6 - index;
      const dayIndex = (todayDayIndex - offset + 7) % 7;
      return {
        label: analyticsText.weekDaysSundayFirst[dayIndex],
        dayIndex,
      };
    });
  }, [analyticsText.weekDaysSundayFirst]);
  const todayBarIndex = 6;
  const growthLabel = `${analytics.growth > 0 ? '+' : ''}${analytics.growth}%`;
  const periodLabel = `${analytics.periodDays} ${analyticsText.tapsByPeriod}`;

  React.useEffect(() => {
    const target = analytics.periodTaps;
    const from = animatedTotal;
    const duration = 1200;
    const startAt = Date.now();
    let frameId = 0;

    const tick = () => {
      const progress = Math.min(1, (Date.now() - startAt) / duration);
      setAnimatedTotal(Math.round(from + (target - from) * progress));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [analytics.periodTaps]);

  return (
    <ErrorBoundary>
      <AppShell title={MESSAGES.ui.screens.analytics} tokens={tokens}>
        <ScreenTransition>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={tokens.accent} colors={[tokens.accent]} />}
          >
            {query.isError && !query.data ? (
              <ErrorState
                tokens={tokens}
                onRetry={() => {
                  void query.refetch();
                }}
              />
            ) : null}

            {!query.isError || query.data ? (
              <>
                {query.error ? (
                  <Pressable
                    style={[styles.errorCard, { borderColor: tokens.red, backgroundColor: `${tokens.red}12` }]}
                    onPress={() => void queryClient.invalidateQueries({ queryKey: queryKeys.analytics })}
                  >
                    <Text style={[styles.errorText, { color: tokens.red }]}>{MESSAGES.query.analyticsCacheUpdateFailed}</Text>
                    <Text style={[styles.errorRetry, { color: tokens.text }]}>{analyticsText.retry}</Text>
                  </Pressable>
                ) : null}

                {showInitialSkeleton ? (
                  <>
                    <View style={[styles.kpiCard, styles.skeletonCard, { borderColor: tokens.border }]}>
                      <SkeletonBlock tokens={tokens} height={10} width={110} radius={6} />
                      <View style={styles.skeletonKpiRow}>
                        <View style={styles.skeletonKpiLeft}>
                          <SkeletonBlock tokens={tokens} height={38} width={110} radius={10} />
                          <SkeletonBlock tokens={tokens} height={12} width={140} radius={6} />
                        </View>
                        <SkeletonBlock tokens={tokens} height={42} width={102} radius={10} />
                      </View>
                    </View>

                    <View style={[styles.weekCard, styles.skeletonCard, { borderColor: tokens.border }]}>
                      <SkeletonBlock tokens={tokens} height={10} width={88} radius={6} />
                      <View style={styles.skeletonWeekRow}>
                        {Array.from({ length: 7 }).map((_, i) => (
                          <View key={`wk-sk-${i}`} style={styles.skeletonWeekCol}>
                            <SkeletonBlock tokens={tokens} height={10} width={18} radius={4} />
                            <SkeletonBlock tokens={tokens} height={52} width={16} radius={4} />
                            <SkeletonBlock tokens={tokens} height={10} width={16} radius={4} />
                          </View>
                        ))}
                      </View>
                    </View>

                    {Array.from({ length: 3 }).map((_, i) => (
                      <View key={`city-sk-${i}`} style={[styles.cityRow, styles.skeletonCard, { borderColor: tokens.border }]}>
                        <View style={styles.cityHeader}>
                          <SkeletonBlock tokens={tokens} height={12} width='42%' radius={6} />
                          <SkeletonBlock tokens={tokens} height={12} width={56} radius={6} />
                        </View>
                        <SkeletonBlock tokens={tokens} height={8} width='100%' radius={999} />
                      </View>
                    ))}
                  </>
                ) : null}

                {!showInitialSkeleton ? (
                  <View style={[styles.kpiCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  <Label color={tokens.textMuted}>{periodLabel}</Label>
                  <View style={styles.kpiRow}>
                    <View>
                      <Text style={[styles.kpiValue, { color: tokens.text }]}>{animatedTotal}</Text>
                      <Text style={[styles.kpiGrowth, { color: analytics.growth >= 0 ? tokens.green : tokens.red }]}>
                        {`${analytics.growth >= 0 ? '↑' : '↓'} ${growthLabel} ${analyticsText.monthGrowth}`}
                      </Text>
                      <Text style={[styles.kpiMeta, { color: tokens.textMuted }]}>
                        {`${analyticsText.totalTaps}: ${analytics.totalTaps} · ${analyticsText.todayTaps}: ${analytics.todayTaps}`}
                      </Text>
                    </View>
                    <TrendingUp size={18} strokeWidth={1.5} color={analytics.growth >= 0 ? tokens.green : tokens.red} />
                    <Sparkline data={analytics.monthTaps} color={tokens.accent} width={100} height={44} />
                  </View>
                  </View>
                ) : null}

                {!showInitialSkeleton ? (
                  <View style={[styles.weekCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  <Label color={tokens.textMuted} style={styles.weekLabel}>{analyticsText.thisWeek}</Label>
                  <View style={styles.weekRow}>
                    {analytics.weekTaps.map((v, i) => (
                      <View key={`w-${i}`} style={styles.weekCol}>
                        <Text style={[styles.weekNum, { color: isDark ? 'rgba(255,255,255,0.72)' : tokens.textSub }]}>{v}</Text>
                        <View style={[styles.weekTrack, { backgroundColor: weekTrackColor }]}>
                          <AnimatedBar
                            ratio={v <= 0 ? 0 : Math.max(0.06, v / weekMax)}
                            delay={i * 70}
                            color={i === todayBarIndex || days[i]?.dayIndex === 5 ? tokens.accent : weekBarMutedColor}
                          />
                        </View>
                      <Text style={[styles.weekDay, { color: i === todayBarIndex ? tokens.text : (isDark ? 'rgba(255,255,255,0.62)' : tokens.textMuted) }]}>{days[i]?.label ?? ''}</Text>
                    </View>
                  ))}
                  </View>
                  </View>
                ) : null}

                {!showInitialSkeleton ? (
                  <>
                    <Label color={isDark ? 'rgba(255,255,255,0.52)' : tokens.textMuted}>{analyticsText.cities}</Label>
                    {cityStats.length > 0 ? cityStats.map((item, index) => {
                      const fillRatio = Math.max(0.08, item.taps / cityMax);
                      const localizedCityName = localizeCityName(item.city, isUz);
                      return (
                        <View key={`${item.city}-${index}`} style={[styles.cityRow, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                          <View style={styles.cityHeader}>
                            <Text style={[styles.cityName, { color: tokens.text }]} numberOfLines={1}>{localizedCityName}</Text>
                            <Text style={[styles.cityMeta, { color: tokens.textMuted }]}>{`${item.taps} (${item.percent}%)`}</Text>
                          </View>
                          <View style={[styles.cityTrack, { backgroundColor: cityTrackColor }]}>
                            <View style={[styles.cityFill, { backgroundColor: cityFillColor, width: `${Math.round(fillRatio * 100)}%` }]} />
                          </View>
                        </View>
                      );
                    }) : (
                      <Text style={[styles.loadingText, { color: tokens.textMuted }]}>{analyticsText.noCities}</Text>
                    )}

                    <Label color={isDark ? 'rgba(255,255,255,0.52)' : tokens.textMuted}>{analyticsText.sources}</Label>
                    {analytics.sources.length > 0 ? uniqueBy(analytics.sources, s => s.source).map((item, index) => (
                      <SourceRow
                        key={`${item.source}-${index}`}
                        source={item.source}
                        count={item.count}
                        percent={item.percent}
                        index={index}
                        tokens={tokens}
                      />
                    )) : (
                      <Text style={[styles.loadingText, { color: tokens.textMuted }]}>{analyticsText.noSources}</Text>
                    )}
                  </>
                ) : null}
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
    paddingTop: 14,
    paddingBottom: 28,
    gap: 16,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  errorRetry: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  skeletonCard: {
    backgroundColor: 'transparent',
  },
  skeletonKpiRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
  },
  skeletonKpiLeft: {
    gap: 8,
    flex: 1,
  },
  skeletonWeekRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 76,
  },
  skeletonWeekCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  kpiCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  kpiRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kpiValue: {
    fontSize: 40,
    lineHeight: 40,
    fontFamily: 'Inter_600SemiBold',
  },
  kpiGrowth: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  kpiMeta: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  weekCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  weekLabel: {
    marginBottom: 16,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 76,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekNum: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  weekTrack: {
    width: '100%',
    height: 52,
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  weekBar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  weekDay: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  cityRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  cityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cityName: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  cityMeta: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  cityTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cityFill: {
    height: '100%',
    borderRadius: 999,
  },
});
