import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
import { useThemeContext } from '@/theme/ThemeProvider';
import { resolveSource } from '@/utils/sourceConfig';

interface AnalyticsPayload {
  totalTaps: number;
  growth: number;
  monthTaps: number[];
  weekTaps: number[];
  sources: SourceStat[];
  geo: Array<{ city: string; x: number; y: number; r: number; value?: number }>;
}

type RegionId =
  | 'karakalpakstan'
  | 'khorezm'
  | 'bukhara_navoi'
  | 'samarkand_jizzakh'
  | 'tashkent_sirdarya'
  | 'fergana_valley'
  | 'qashqadaryo'
  | 'surxondaryo';

const MAP_REGIONS: Array<{ id: RegionId; path: string }> = [
  { id: 'karakalpakstan', path: 'M22,20 L64,10 L67,11 L53,67 L40,72 L22,81 Z' },
  { id: 'khorezm', path: 'M53,67 L67,57 L88,66 L97,82 L87,94 L66,100 L40,72 Z' },
  { id: 'bukhara_navoi', path: 'M88,66 L120,85 L142,92 L132,109 L97,110 L87,94 L97,82 Z' },
  { id: 'samarkand_jizzakh', path: 'M132,109 L142,92 L170,74 L198,70 L198,106 L171,104 Z' },
  { id: 'tashkent_sirdarya', path: 'M170,74 L198,70 L206,83 L217,110 L198,106 Z' },
  { id: 'fergana_valley', path: 'M206,83 L232,92 L239,80 L261,68 L286,80 L306,88 L284,100 L231,110 L217,110 Z' },
  { id: 'qashqadaryo', path: 'M132,109 L171,104 L176,129 L158,121 L147,113 Z' },
  { id: 'surxondaryo', path: 'M171,104 L206,112 L212,117 L225,121 L228,133 L219,150 L197,146 L198,136 L176,129 Z' },
];

const CITY_TO_REGION: Record<string, RegionId> = {
  // Tashkent/Sirdarya/Jizzakh
  tashkent: 'tashkent_sirdarya',
  sirdarya: 'tashkent_sirdarya',
  gulistan: 'tashkent_sirdarya',
  jizzakh: 'samarkand_jizzakh',
  djizzak: 'samarkand_jizzakh',

  // Fergana valley
  andijan: 'fergana_valley',
  namangan: 'fergana_valley',
  fergana: 'fergana_valley',

  // Samarkand/Jizzakh
  samarkand: 'samarkand_jizzakh',

  // Bukhara/Navoi
  bukhara: 'bukhara_navoi',
  navoi: 'bukhara_navoi',

  // West
  nukus: 'karakalpakstan',
  karakalpakstan: 'karakalpakstan',
  urgench: 'khorezm',
  khorezm: 'khorezm',
  xorazm: 'khorezm',

  // South
  qarshi: 'qashqadaryo',
  karshi: 'qashqadaryo',
  qashqadaryo: 'qashqadaryo',
  termiz: 'surxondaryo',
  termez: 'surxondaryo',
  surxondaryo: 'surxondaryo',
  surkhandarya: 'surxondaryo',
};
const UZBEKISTAN_OUTLINE_PATH =
  'M197.11,146.39 L197.56,136.24 L175.5,129.14 L158.16,121.02 L147.34,113.21 L128.38,101.76 L120.22,84.66 L114.66,81.65 L96.73,82.41 L90.38,79.02 L88.61,65.78 L66.26,57.02 L52.29,66.66 L38.12,72.37 L40.85,80.72 L22.14,80.95 L21.49,19.8 L64.18,10 L67.28,11.44 L92.98,23.31 L106.55,29.59 L122.39,44.53 L141.83,42.12 L170.28,40.83 L190.13,52.94 L188.89,69.57 L196.97,69.69 L200.35,83.27 L221.44,83.81 L225.98,91.67 L232.16,91.56 L239.42,79.7 L261.29,68.14 L270.8,65.07 L275.73,66.7 L261.81,77.44 L274.04,83.69 L285.86,79.55 L305.51,88.29 L284.28,100.23 L271.66,98.6 L264.82,99.03 L262.44,94.42 L265.9,86.73 L243.72,90.58 L238.45,101.22 L230.57,110.39 L216.72,109.61 L212.42,116.91 L224.59,120.87 L228.18,133.22 L218.86,150 L206.35,146.5 L197.11,146.39 Z';

function normalizeCityKey(city: string): string {
  const map: Record<string, string> = {
    '\u0430': 'a',
    '\u0431': 'b',
    '\u0432': 'v',
    '\u0433': 'g',
    '\u0434': 'd',
    '\u0435': 'e',
    '\u0451': 'yo',
    '\u0436': 'j',
    '\u0437': 'z',
    '\u0438': 'i',
    '\u0439': 'y',
    '\u043a': 'k',
    '\u043b': 'l',
    '\u043c': 'm',
    '\u043d': 'n',
    '\u043e': 'o',
    '\u043f': 'p',
    '\u0440': 'r',
    '\u0441': 's',
    '\u0442': 't',
    '\u0443': 'u',
    '\u0444': 'f',
    '\u0445': 'h',
    '\u0446': 'c',
    '\u0447': 'ch',
    '\u0448': 'sh',
    '\u0449': 'sch',
    '\u044b': 'y',
    '\u044d': 'e',
    '\u044e': 'yu',
    '\u044f': 'ya',
    '\u0433\u02bb': 'g',
    '\u045b': 'g',
    '\u045e': 'u',
    '\u049b': 'q',
    '\u04b3': 'h',
  };

  const normalized = city
    .trim()
    .toLowerCase()
    .replace(/[\u02bc\u02bb\u2018\u2019\u201b\u0060\u00b4]/g, "'")
    .replace(/\u045e/g, '\u0443')
    .replace(/\u049b/g, '\u043a')
    .replace(/\u04b3/g, '\u0445')
    .replace(/\u045b/g, '\u0433')
    .replace(/\u02bb/g, '');

  return normalized
    .split('')
    .map((ch) => map[ch] || ch)
    .join('')
    .replace(/['`\-\s]+/g, '');
}

function resolveRegionByCity(city: string): RegionId | null {
  const key = normalizeCityKey(city);
  if (!key) return null;
  return CITY_TO_REGION[key] || null;
}

function buildRegionTotals(points: Array<{ city: string; value?: number }>): Record<RegionId, number> {
  const totals: Record<RegionId, number> = {
    karakalpakstan: 0,
    khorezm: 0,
    bukhara_navoi: 0,
    samarkand_jizzakh: 0,
    tashkent_sirdarya: 0,
    fergana_valley: 0,
    qashqadaryo: 0,
    surxondaryo: 0,
  };

  for (const point of points) {
    const region = resolveRegionByCity(String(point.city || ''));
    if (!region) continue;
    const value = Number(point.value || 0);
    totals[region] += Number.isFinite(value) ? value : 0;
  }

  return totals;
}

function parseSummary(raw: unknown): AnalyticsPayload {
  const source = (raw as { summary?: any })?.summary ?? (raw as any);
  const total = Number(source?.totalTaps ?? source?.total ?? 0);
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
    growth: Number(source?.growth ?? 0),
    monthTaps: month.length === 30 ? month : [...Array.from({ length: Math.max(0, 30 - month.length) }, () => 0), ...month],
    weekTaps: week.length === 7 ? week : [...Array.from({ length: Math.max(0, 7 - week.length) }, () => 0), ...week],
    sources: normalizedSources,
    geo: geoRows.map((item: any) => ({
      city: String(item?.city ?? 'Unknown'),
      x: Number(item?.x ?? 178),
      y: Number(item?.y ?? 72),
      r: Number(item?.r ?? 3),
      value: Number(item?.value ?? 0),
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
  const [animatedTotal, setAnimatedTotal] = React.useState(0);
  const query = useQuery({
    queryKey: queryKeys.analytics,
    queryFn: fetchAnalyticsDashboardLike,
  });
  const isRefreshing = query.isRefetching;
  const onRefresh = React.useCallback(async () => {
    await query.refetch();
  }, [query]);

  React.useEffect(() => {
    void markPushTrigger('analytics').catch(() => undefined);
  }, []);

  const analytics = parseSummary(query.data ?? {});
  const regionTotals = React.useMemo(() => buildRegionTotals(analytics.geo), [analytics.geo]);
  const regionMax = React.useMemo(() => Math.max(...Object.values(regionTotals), 1), [regionTotals]);
  const weekMax = Math.max(...analytics.weekTaps, 1);
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const growthLabel = `${analytics.growth > 0 ? '+' : ''}${analytics.growth}%`;

  React.useEffect(() => {
    const target = analytics.totalTaps;
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
  }, [analytics.totalTaps]);

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
                    <Text style={[styles.errorRetry, { color: tokens.text }]}>Повторить</Text>
                  </Pressable>
                ) : null}

                {query.isLoading && !query.data ? (
                  <>
                    <SkeletonBlock tokens={tokens} height={132} radius={16} />
                    <SkeletonBlock tokens={tokens} height={130} radius={16} />
                  </>
                ) : null}

                <View style={[styles.kpiCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  <Label color={tokens.textMuted}>Тапов за 30 дней</Label>
                  <View style={styles.kpiRow}>
                    <View>
                      <Text style={[styles.kpiValue, { color: tokens.text }]}>{animatedTotal}</Text>
                      <Text style={[styles.kpiGrowth, { color: analytics.growth >= 0 ? tokens.green : tokens.red }]}>
                        {`${analytics.growth >= 0 ? '↑' : '↓'} ${growthLabel} к прошлому месяцу`}
                      </Text>
                    </View>
                    <TrendingUp size={18} strokeWidth={1.5} color={analytics.growth >= 0 ? tokens.green : tokens.red} />
                    <Sparkline data={analytics.monthTaps} color={tokens.accent} width={100} height={44} />
                  </View>
                </View>

                <View style={[styles.weekCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  <Label color={tokens.textMuted} style={styles.weekLabel}>Эта неделя</Label>
                  <View style={styles.weekRow}>
                    {analytics.weekTaps.map((v, i) => (
                      <View key={`w-${i}`} style={styles.weekCol}>
                        <Text style={[styles.weekNum, { color: tokens.textMuted }]}>{v}</Text>
                        <View style={[styles.weekTrack, { backgroundColor: i === 4 ? tokens.accent : tokens.border }]}>
                          <AnimatedBar ratio={Math.max(0.06, v / weekMax)} delay={i * 70} color={i === 4 ? tokens.accent : tokens.borderStrong} />
                        </View>
                        <Text style={[styles.weekDay, { color: i === 4 ? tokens.text : tokens.textMuted }]}>{days[i]}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Label color={tokens.textMuted}>Карта тапов</Label>
                <View style={[styles.mapWrap, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  <Svg viewBox='0 0 327 160' width='100%' height={160}>
                    <Path
                      d={UZBEKISTAN_OUTLINE_PATH}
                      fill={tokens.surface}
                      opacity={0.7}
                      stroke='none'
                    />
                    {MAP_REGIONS.map((region) => {
                      const regionValue = Number(regionTotals[region.id] || 0);
                      const ratio = regionValue > 0 ? regionValue / regionMax : 0;
                      const opacity = regionValue > 0 ? Math.min(0.9, 0.2 + ratio * 0.7) : 0.05;
                      return (
                        <Path
                          key={region.id}
                          d={region.path}
                          fill={tokens.accent}
                          opacity={opacity}
                          stroke={tokens.border}
                          strokeWidth={0.45}
                        />
                      );
                    })}
                    <Path
                      d={UZBEKISTAN_OUTLINE_PATH}
                      fill='none'
                      stroke={tokens.borderStrong}
                      strokeWidth={1.35}
                    />
                    <Path d={UZBEKISTAN_OUTLINE_PATH} fill='none' stroke={tokens.border} strokeWidth={0.7} opacity={0.65} />
                  </Svg>
                </View>

                <Label color={tokens.textMuted}>Источники</Label>
                {analytics.sources.length > 0 ? analytics.sources.map((item, index) => (
                  <SourceRow
                    key={`${item.source}-${index}`}
                    source={item.source}
                    count={item.count}
                    percent={item.percent}
                    index={index}
                    tokens={tokens}
                  />
                )) : (
                  <Text style={[styles.loadingText, { color: tokens.textMuted }]}>Пока нет данных по источникам</Text>
                )}
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
    fontFamily: 'Inter_400Regular',
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
  mapWrap: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
