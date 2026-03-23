import { apiClient, ApiError } from '@/lib/apiClient';
import { resolveAssetUrl } from '@/lib/assetUrl';
import { storageDeleteItem, storageGetItem, storageSetItem } from '@/lib/secureStorage';
import { ProfileCard, ResidentProfile } from '@/types';

const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();
const ANALYTICS_TZ_OFFSET_HOURS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const PRIVATE_ACCESS_STORAGE_PREFIX = 'unqx.private_access.';

function readCache<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function writeCache<T>(key: string, value: T, ttlMs = 60_000): T {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function invalidateCache(keys: string[]): void {
  for (const key of keys) {
    memoryCache.delete(key);
  }
}

function isFallbackError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405 || error.status === 501);
}

function isPlanRestrictedError(error: unknown): boolean {
  return error instanceof ApiError
    && error.status === 403
    && (error.code === 'PLAN_REQUIRED' || error.code === 'UPGRADE_REQUIRED');
}

function shouldFallbackToMobileCardPatch(error: unknown): boolean {
  return isFallbackError(error);
}

function normalizePlanValue(value: unknown): 'none' | 'basic' | 'premium' | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'none' || normalized === 'basic' || normalized === 'premium') {
    return normalized;
  }
  return null;
}

function resolveEffectivePlan(source: any): 'none' | 'basic' | 'premium' | null {
  const payload = source?.user ?? source ?? {};
  return normalizePlanValue(payload?.effectivePlan ?? payload?.plan);
}

function pickPrimarySlug(bootstrap: any): string | null {
  const slugs = Array.isArray(bootstrap?.slugs) ? bootstrap.slugs : [];
  const primary = slugs.find((item: any) => item?.isPrimary);
  return primary?.fullSlug ?? slugs[0]?.fullSlug ?? bootstrap?.selectedSlug ?? null;
}

function normalizeButtons(buttons: ProfileCard['buttons']) {
  const mapType = (icon: string): string => {
    const key = String(icon || '').trim().toLowerCase();
    if (key === 'send' || key === 'telegram') return 'telegram';
    if (key === 'ig' || key === 'instagram') return 'instagram';
    if (key === 'whatsapp' || key === 'wa') return 'whatsapp';
    if (key === 'youtube' || key === 'yt') return 'youtube';
    if (key === 'tiktok') return 'tiktok';
    if (key === 'website' || key === 'globe' || key === 'web' || key === 'link') return 'website';
    if (key === 'phone') return 'phone';
    if (key === 'email' || key === 'mail') return 'email';
    if (key === 'card' || key === 'creditcard' || key === 'credit_card' || key === 'payment' || key === 'pay' || key === 'click') return 'card';
    if (key === 'other' || key === 'chat' || key === 'briefcase' || key === 'linkedin') return 'other';
    return 'other';
  };

  return (buttons || []).map((item) => ({
    type: mapType(item.icon),
    label: item.label,
    value: item.url,
  }));
}

function normalizeProfileString(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeLegacyMobileTheme(value: unknown): 'light' | 'dark' | 'gradient' {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'light') return 'light';
  if (raw === 'gradient') return 'gradient';
  return 'dark';
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeGrowthPercent(current: number, delta: number): number {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  const previous = safeCurrent - safeDelta;
  if (previous <= 0) {
    return safeCurrent > 0 ? 100 : 0;
  }
  return Math.round((safeDelta / previous) * 100);
}

function sumSlugViews(rawSlugs: unknown): number {
  const slugs = Array.isArray(rawSlugs) ? rawSlugs : [];
  return slugs.reduce((total, item: any) => {
    const views = toFiniteNumber(item?.stats?.views ?? item?.views ?? item?.tapCount ?? 0, 0);
    return total + Math.max(0, views);
  }, 0);
}

function normalizeSeries(raw: unknown, length: number): number[] {
  const values = Array.isArray(raw)
    ? raw.map((item) => toFiniteNumber(item, 0))
    : [];
  if (values.length >= length) {
    return values.slice(-length);
  }
  return [...Array.from({ length: Math.max(0, length - values.length) }, () => 0), ...values];
}

function toAnalyticsDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + ANALYTICS_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayAnalyticsDateKey(): string {
  return toAnalyticsDateKey(new Date());
}

function extractTodayFromViewsByDay(items: unknown): number {
  const list = Array.isArray(items) ? items : [];
  const today = todayAnalyticsDateKey();
  for (const item of list) {
    if (String((item as any)?.date ?? '') === today) {
      return toFiniteNumber((item as any)?.value ?? 0, 0);
    }
  }
  return 0;
}

function normalizeGeoRows(input: unknown): Array<{ city: string; x: number; y: number; r: number; value: number }> {
  const rows = Array.isArray(input) ? input : [];
  return rows
    .map((item: any) => ({
      city: String(item?.city ?? '').trim(),
      x: toFiniteNumber(item?.x ?? 178, 178),
      y: toFiniteNumber(item?.y ?? 72, 72),
      r: Math.max(2, Math.min(8, toFiniteNumber(item?.r ?? 3, 3))),
      value: Math.max(0, toFiniteNumber(item?.value ?? item?.count ?? item?.taps ?? 0, 0)),
    }))
    .filter((item) => item.city.length > 0);
}

function mapByDayToSeries(items: unknown[], length: number): number[] {
  const values = Array.from({ length }, () => 0);
  const now = Date.now();
  const map = new Map<string, number>();

  if (Array.isArray(items)) {
    for (const item of items) {
      const date = String((item as any)?.date ?? '');
      const value = Number((item as any)?.value ?? 0);
      if (date) {
        map.set(date, Number.isFinite(value) ? value : 0);
      }
    }
  }

  for (let i = length - 1; i >= 0; i -= 1) {
    const diffDays = length - 1 - i;
    const key = toAnalyticsDateKey(new Date(now - diffDays * DAY_MS));
    values[i] = map.get(key) ?? 0;
  }

  return values;
}

function normalizeTapSource(value: unknown): 'nfc' | 'qr' | 'direct' | 'share' | 'widget' {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'telegram') return 'share';
  if (raw === 'other') return 'direct';
  if (raw === 'nfc_scan' || raw === 'nfc_write') return 'nfc';
  if (raw === 'nfc' || raw === 'qr' || raw === 'direct' || raw === 'share' || raw === 'widget') {
    return raw;
  }
  return 'direct';
}

function normalizeResidentSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

function parseResidentSlugs(raw: unknown, fallbackSlug: string): string[] {
  const source = Array.isArray(raw) ? raw : [];
  const set = new Set<string>();

  for (const item of source) {
    const normalized = normalizeResidentSlug(item);
    if (normalized) {
      set.add(normalized);
    }
  }

  const fallback = normalizeResidentSlug(fallbackSlug);
  if (fallback) {
    set.add(fallback);
  }

  return Array.from(set);
}

function privateAccessStorageKey(slug: string): string {
  return `${PRIVATE_ACCESS_STORAGE_PREFIX}${slug}`;
}

async function readPrivateAccessToken(slug: string): Promise<{ token: string; expiresAtMs: number } | null> {
  const key = privateAccessStorageKey(slug);
  const raw = await storageGetItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown };
    const token = String(parsed?.token ?? '').trim();
    const expiresAtRaw = String(parsed?.expiresAt ?? '').trim();
    const expiresAtMs = Date.parse(expiresAtRaw);
    if (!token || !Number.isFinite(expiresAtMs)) {
      await storageDeleteItem(key);
      return null;
    }
    if (expiresAtMs <= Date.now()) {
      await storageDeleteItem(key);
      return null;
    }
    return { token, expiresAtMs };
  } catch {
    await storageDeleteItem(key);
    return null;
  }
}

async function writePrivateAccessToken(slug: string, token: string, expiresAt: string): Promise<void> {
  const key = privateAccessStorageKey(slug);
  await storageSetItem(key, JSON.stringify({ token, expiresAt }));
}

async function clearPrivateAccessToken(slug: string): Promise<void> {
  await storageDeleteItem(privateAccessStorageKey(slug));
}

function mapResidentProfile(raw: any): ResidentProfile {
  const source = raw?.profile ?? raw ?? {};
  const slug = normalizeResidentSlug(source?.slug) || 'UNQ000';
  const slugs = parseResidentSlugs(source?.slugs, slug);
  const addressRaw = source?.address ?? source?.location ?? source?.addressLine ?? source?.addressText ?? source?.street;

  return {
    name: String(source?.name ?? 'Unknown'),
    slug,
    slugs: slugs.length ? slugs : [slug],
    slugPrice: Number.isFinite(Number(source?.slugPrice ?? source?.price))
      ? Number(source?.slugPrice ?? source?.price)
      : undefined,
    avatarUrl: resolveAssetUrl(source?.avatarUrl ? String(source.avatarUrl) : undefined),
    address: addressRaw ? String(addressRaw) : undefined,
    city: source?.city ? String(source.city) : undefined,
    tag: String(source?.tag ?? 'basic'),
    taps: Number(source?.taps ?? 0),
    role: source?.role ? String(source.role) : undefined,
    bio: source?.bio ? String(source.bio) : undefined,
    email: source?.email ? String(source.email) : undefined,
    phone: source?.phone ? String(source.phone) : undefined,
    buttons: Array.isArray(source?.buttons)
      ? source.buttons
        .map((item: any) => ({
          icon: item?.icon ? String(item.icon) : undefined,
          label: String(item?.label ?? ''),
          url: String(item?.url ?? ''),
        }))
        .filter((item: { label: string; url: string }) => item.label && item.url)
      : [],
    saved: Boolean(source?.saved),
    subscribed: Boolean(source?.subscribed),
    username: source?.username ? String(source.username) : undefined,
    isPrivate: Boolean(source?.isPrivate ?? raw?.privateAccess?.required),
    isLocked: Boolean(source?.isLocked ?? (raw?.privateAccess?.required && !raw?.privateAccess?.granted)),
    lockedMessage: source?.lockedMessage ? String(source.lockedMessage) : undefined,
    privateAccessExpiresAt: source?.privateAccessExpiresAt
      ? String(source.privateAccessExpiresAt)
      : (raw?.privateAccess?.expiresAt ? String(raw.privateAccess.expiresAt) : null),
  };
}

function mapSources(input: unknown, total: number) {
  const rows = Array.isArray(input)
    ? input.map((item: any) => ({
      source: normalizeTapSource(item?.source ?? item?.label ?? 'direct'),
      count: Number(item?.count ?? item?.value ?? 0),
      percent: Number(item?.percent ?? 0),
    }))
    : Object.entries((input || {}) as Record<string, unknown>).map(([source, count]) => ({
      source: normalizeTapSource(source),
      count: Number(count ?? 0),
      percent: 0,
    }));

  return rows
    .map((item) => {
      const safeCount = Number.isFinite(item.count) ? item.count : 0;
      const safePercent = Number.isFinite(item.percent) && item.percent > 0
        ? item.percent
        : (total > 0 ? Math.round((safeCount / total) * 100) : 0);
      return {
        source: item.source,
        count: safeCount,
        percent: safePercent,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

function mapGeo(input: Record<string, unknown>) {
  const unsupportedCityNames = new Set([
    'неизвестно',
    'unknown',
    'other',
    'the dalles',
    'usa',
  ]);

  const rows = Object.entries(input || {})
    .map(([city, count]) => ({
      city,
      count: Number(count ?? 0),
    }))
    .filter((row) => {
      if (row.count <= 0) return false;
      return !unsupportedCityNames.has(row.city.trim().toLowerCase());
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxCount = Math.max(...rows.map((row) => row.count), 1);
  const slots = [
    { x: 178, y: 72 },
    { x: 200, y: 75 },
    { x: 80, y: 90 },
    { x: 230, y: 55 },
    { x: 145, y: 98 },
  ];

  const cityCoords: Record<string, { x: number; y: number }> = {
    tashkent: { x: 178, y: 72 },
    'ташкент': { x: 178, y: 72 },
    samarkand: { x: 152, y: 88 },
    'самарканд': { x: 152, y: 88 },
    bukhara: { x: 121, y: 92 },
    'бухара': { x: 121, y: 92 },
    andijan: { x: 232, y: 73 },
    'андижан': { x: 232, y: 73 },
    namangan: { x: 219, y: 69 },
    'наманган': { x: 219, y: 69 },
    fergana: { x: 221, y: 79 },
    'фергана': { x: 221, y: 79 },
    nukus: { x: 66, y: 63 },
    'нукус': { x: 66, y: 63 },
    qarshi: { x: 141, y: 105 },
    karshi: { x: 141, y: 105 },
    'карши': { x: 141, y: 105 },
    termiz: { x: 167, y: 126 },
    'термез': { x: 167, y: 126 },
    jizzakh: { x: 167, y: 82 },
    'джизак': { x: 167, y: 82 },
    urgench: { x: 87, y: 79 },
    'ургенч': { x: 87, y: 79 },
  };

  return rows.map((row, index) => ({
    city: row.city,
    x: cityCoords[row.city.trim().toLowerCase()]?.x ?? slots[index]?.x ?? 178,
    y: cityCoords[row.city.trim().toLowerCase()]?.y ?? slots[index]?.y ?? 72,
    r: Math.max(2, Math.min(8, Math.round((row.count / maxCount) * 8))),
    value: row.count,
  }));
}

function isLocalImageUri(value: string): boolean {
  return /^(file|content|ph):/i.test(value);
}

function detectMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function detectFileName(uri: string, mimeType: string): string {
  const fromPath = uri.split('/').at(-1)?.split('?')[0]?.trim();
  if (fromPath && /\.[a-z0-9]+$/i.test(fromPath)) {
    return fromPath;
  }
  if (mimeType === 'image/png') return 'avatar.png';
  if (mimeType === 'image/webp') return 'avatar.webp';
  if (mimeType === 'image/heic') return 'avatar.heic';
  return 'avatar.jpg';
}

async function syncProfileAvatar(avatarUrl: unknown): Promise<string | null | undefined> {
  const raw = String(avatarUrl ?? '').trim();

  if (!raw) {
    try {
      const deleted = await apiClient.delete<{ avatarUrl?: string | null }>('/profile/card/avatar');
      return deleted?.avatarUrl ?? null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      if (isPlanRestrictedError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  if (!isLocalImageUri(raw)) {
    return undefined;
  }

  const mimeType = detectMimeType(raw);
  const fileName = detectFileName(raw, mimeType);
  const formData = new FormData();
  formData.append('file', {
    uri: raw,
    type: mimeType,
    name: fileName,
  } as any);

  let uploaded: { avatarUrl?: string | null } | null = null;
  try {
    uploaded = await apiClient.post<{ avatarUrl?: string | null }>('/profile/card/avatar', formData);
  } catch (error) {
    if (isPlanRestrictedError(error)) {
      return undefined;
    }
    throw error;
  }

  if (typeof uploaded?.avatarUrl === 'string') {
    return uploaded.avatarUrl;
  }
  if (uploaded?.avatarUrl === null) {
    return null;
  }
  return undefined;
}

interface ProfileAnalyticsPayload {
  bootstrap: any;
  analytics: any;
}

async function fetchTotalTapsFromProfileStats(): Promise<number | null> {
  const cached = readCache<number>('profile-total-taps');
  if (typeof cached === 'number' && cached > 0) {
    return cached;
  }

  try {
    const bootstrap = await apiClient.get<any>('/profile/bootstrap');
    const totalFromBootstrap = sumSlugViews(bootstrap?.slugs);
    if (totalFromBootstrap > 0) {
      return writeCache('profile-total-taps', totalFromBootstrap);
    }
  } catch {
    // Non-fatal: summary endpoint can still provide totals.
  }

  try {
    const slugsPayload = await apiClient.get<any>('/profile/slugs');
    const totalFromSlugs = sumSlugViews(slugsPayload?.items);
    if (totalFromSlugs > 0) {
      return writeCache('profile-total-taps', totalFromSlugs);
    }
  } catch {
    // Non-fatal: keep fallback chain alive.
  }

  return null;
}

async function fetchProfileAnalyticsPayload(period: number): Promise<ProfileAnalyticsPayload | null> {
  let bootstrap: any;
  try {
    bootstrap = await apiClient.get<any>('/profile/analytics/bootstrap');
  } catch (error) {
    if (isFallbackError(error)) {
      return null;
    }
    throw error;
  }

  const slug = pickPrimarySlug(bootstrap);
  if (!slug) {
    return null;
  }

  try {
    const analytics = await apiClient.get<any>('/profile/analytics', {
      query: { slug, period },
    });
    return { bootstrap, analytics };
  } catch (error) {
    if (isFallbackError(error)) {
      return null;
    }
    throw error;
  }
}

export async function fetchCurrentUserLike(): Promise<unknown> {
  const cached = readCache<unknown>('current-user');
  if (cached) return cached;
  const value = await apiClient.getFirst(['/me', '/profile/bootstrap', '/auth/me']);
  return writeCache('current-user', value);
}

export async function fetchHomeSummaryLike(): Promise<unknown> {
  const cached = readCache<unknown>('home-summary');
  if (cached) return cached;

  try {
    const [summaryPayload, totalFromSlugStats] = await Promise.all([
      apiClient.get<any>('/analytics/summary'),
      fetchTotalTapsFromProfileStats(),
    ]);
    const summarySource = summaryPayload?.summary ?? summaryPayload ?? {};
    const apiTotal = toFiniteNumber(summarySource?.totalTaps ?? summarySource?.total ?? 0, 0);
    const resolvedTotal = totalFromSlugStats && totalFromSlugStats > apiTotal ? totalFromSlugStats : apiTotal;

    return writeCache('home-summary', {
      ...(summaryPayload?.summary ? summaryPayload : {}),
      summary: {
        ...summarySource,
        totalTaps: resolvedTotal,
      },
    });
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }

    const profilePayload = await fetchProfileAnalyticsPayload(30);
    if (profilePayload) {
      const totalFromSlugs = await fetchTotalTapsFromProfileStats();
      const analytics = profilePayload.analytics;
      const kpi = analytics?.kpi ?? {};
      const byDay = Array.isArray(analytics?.chart?.viewsByDay) ? analytics.chart.viewsByDay : [];
      const periodViews = toFiniteNumber(kpi.views ?? 0, 0);

      return writeCache('home-summary', {
        summary: {
          totalTaps: totalFromSlugs && totalFromSlugs > 0 ? totalFromSlugs : periodViews,
          todayTaps: Number(byDay.at(-1)?.value ?? 0),
          growth: computeGrowthPercent(periodViews, Number(kpi?.trends?.views ?? 0)),
          weekTaps: byDay.slice(-7).map((item: any) => Number(item?.value ?? 0)),
          monthTaps: byDay.slice(-30).map((item: any) => Number(item?.value ?? 0)),
        },
      });
    }

    const liveStats = await apiClient.getFirst<any>(['/public/live-stats']);
    return writeCache('home-summary', {
      summary: {
        totalTaps: Number(liveStats?.todayTotal ?? liveStats?.activeCardsTotal ?? 0),
        todayTaps: Number(liveStats?.todayActivated ?? 0),
        growth: 0,
      },
    });
  }
}

export async function fetchAnalyticsDashboardLike(): Promise<unknown> {
  const cached = readCache<unknown>('analytics-dashboard');
  if (cached) return cached;

  try {
    const [summaryPayload, profilePayload, totalFromSlugStats] = await Promise.all([
      apiClient.get<any>('/analytics/summary'),
      fetchProfileAnalyticsPayload(30).catch((error) => {
        if (isFallbackError(error) || isPlanRestrictedError(error)) {
          return null;
        }
        throw error;
      }),
      fetchTotalTapsFromProfileStats(),
    ]);

    const sourceSummary = summaryPayload?.summary ?? summaryPayload ?? {};
    const initialTotal = toFiniteNumber(sourceSummary?.totalTaps ?? sourceSummary?.total ?? 0, 0);
    const totalTaps = Math.max(initialTotal, toFiniteNumber(totalFromSlugStats, 0));
    const todayTaps = toFiniteNumber(sourceSummary?.todayTaps ?? sourceSummary?.today ?? 0, 0);
    const growth = toFiniteNumber(sourceSummary?.growth ?? 0, 0);
    let weekTaps = normalizeSeries(sourceSummary?.weekTaps, 7);
    let monthTaps = normalizeSeries(sourceSummary?.monthTaps, 30);
    let sources = mapSources(sourceSummary?.sources ?? [], totalTaps);
    let geo = normalizeGeoRows(sourceSummary?.geo);
    let periodTaps = toFiniteNumber(monthTaps.reduce((sum, value) => sum + value, 0), 0);
    let periodDays = 30;

    if (profilePayload) {
      const analytics = profilePayload.analytics ?? {};
      const viewsByDay = Array.isArray(analytics?.chart?.viewsByDay) ? analytics.chart.viewsByDay : [];
      const profileViews = toFiniteNumber(analytics?.kpi?.views ?? 0, 0);
      const profileTrends = toFiniteNumber(analytics?.kpi?.trends?.views ?? 0, 0);
      const profileGrowth = computeGrowthPercent(profileViews, profileTrends);
      const profilePeriod = toFiniteNumber(analytics?.period ?? 30, 30);

      periodDays = profilePeriod > 0 ? profilePeriod : 30;
      periodTaps = profileViews;
      if (viewsByDay.length > 0) {
        weekTaps = mapByDayToSeries(viewsByDay, 7);
        monthTaps = mapByDayToSeries(viewsByDay, 30);
      }
      sources = mapSources(analytics?.chart?.trafficSources ?? {}, profileViews || totalTaps);
      geo = mapGeo((analytics?.chart?.geography ?? {}) as Record<string, unknown>);

      return writeCache('analytics-dashboard', {
        summary: {
          totalTaps,
          todayTaps: todayTaps > 0 ? todayTaps : extractTodayFromViewsByDay(viewsByDay),
          growth: Number.isFinite(growth) ? growth : profileGrowth,
          periodTaps,
          periodDays,
          weekTaps,
          monthTaps,
          sources,
          geo,
        },
      });
    }

    return writeCache('analytics-dashboard', {
      summary: {
        totalTaps,
        todayTaps,
        growth,
        periodTaps,
        periodDays,
        weekTaps,
        monthTaps,
        sources,
        geo,
      },
    });
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }

    const profilePayload = await fetchProfileAnalyticsPayload(30);
    if (profilePayload) {
      const analytics = profilePayload.analytics;
      const byDay = Array.isArray(analytics?.chart?.viewsByDay) ? analytics.chart.viewsByDay : [];
      const trafficSources = (analytics?.chart?.trafficSources ?? {}) as Record<string, unknown>;
      const geography = (analytics?.chart?.geography ?? {}) as Record<string, unknown>;
      const totalViews = Number(analytics?.kpi?.views ?? 0);
      const period = toFiniteNumber(analytics?.period ?? 30, 30);

      return writeCache('analytics-dashboard', {
        summary: {
          totalTaps: Math.max(totalViews, toFiniteNumber(await fetchTotalTapsFromProfileStats(), 0)),
          todayTaps: extractTodayFromViewsByDay(byDay),
          growth: computeGrowthPercent(totalViews, Number(analytics?.kpi?.trends?.views ?? 0)),
          periodTaps: totalViews,
          periodDays: period > 0 ? period : 30,
          monthTaps: mapByDayToSeries(byDay, 30),
          weekTaps: mapByDayToSeries(byDay, 7),
          sources: mapSources(trafficSources, totalViews),
          geo: mapGeo(geography),
        },
      });
    }

    return writeCache('analytics-dashboard', {
      summary: {
        totalTaps: 0,
        todayTaps: 0,
        growth: 0,
        periodTaps: 0,
        periodDays: 30,
        monthTaps: Array.from({ length: 30 }, () => 0),
        weekTaps: Array.from({ length: 7 }, () => 0),
        sources: [],
        geo: [],
      },
    });
  }
}

export async function fetchHomeRecentLike(): Promise<unknown> {
  const cached = readCache<unknown>('home-recent');
  if (cached) return cached;

  try {
    return writeCache('home-recent', await apiClient.get<any>('/analytics/recent'));
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }
  }

  try {
    const requests = await apiClient.get<any>('/profile/requests');
    const requestItems = Array.isArray(requests?.items) ? requests.items.slice(0, 5) : [];
    if (requestItems.length > 0) {
      return writeCache('home-recent', {
        items: requestItems.map((item: any, index: number) => ({
          id: item?.id ?? `req-${index}`,
          name: 'Заявка',
          slug: item?.slug ?? item?.fullSlug ?? item?.selectedSlug ?? '',
          source: item?.slug ?? 'UNQ000',
          time: item?.createdAt ?? item?.purchasedAt ?? 'недавно',
        })),
      });
    }
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }
  }

  const leaderboard = await apiClient.getFirst<any>(['/leaderboard']);
  const items = Array.isArray(leaderboard?.items) ? leaderboard.items.slice(0, 5) : [];

  return writeCache('home-recent', {
    items: items.map((item: any, index: number) => ({
      id: item?.id ?? `lb-${index}`,
      name: item?.name ?? item?.ownerName ?? item?.displayName ?? 'UNQX User',
      slug: item?.slug ?? item?.fullSlug ?? item?.selectedSlug ?? '',
      source: item?.slug ?? 'UNQ000',
      time: 'недавно',
    })),
  });
}

export async function fetchContactsLike(query: string): Promise<unknown> {
  try {
    // Personal contacts list for the current user.
    return await apiClient.get<any>('/contacts', {
      query: query.trim().length > 0 ? { q: query.trim() } : undefined,
    });
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }
  }

  // Never fallback contacts to platform-wide lists.
  return { items: [] };
}

export async function fetchDirectoryLike(query: string, page: number): Promise<unknown> {
  const normalizedQuery = query.trim();
  try {
    // Public platform directory (residents).
    const directory = await apiClient.get<any>('/directory', {
      query: {
        q: normalizedQuery,
        page,
      },
    });
    const items = Array.isArray(directory?.items) ? directory.items : [];
    if (items.length > 0 || normalizedQuery.length > 0) {
      return directory;
    }
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }
  }

  // Backward-compatible fallback if /directory is unavailable.
  const search = await apiClient.get<any>('/cards/search', {
    query: {
      q: normalizedQuery,
    },
  });
  const searchItems = Array.isArray(search?.items) ? search.items : [];
  if (searchItems.length > 0 || normalizedQuery.length > 0) {
    return search;
  }

  const leaderboard = await apiClient.getFirst<any>(['/leaderboard']);
  return {
    items: Array.isArray(leaderboard?.items) ? leaderboard.items : [],
  };
}

export async function fetchResidentProfileLike(slug: string): Promise<ResidentProfile> {
  const normalizedSlug = normalizeResidentSlug(slug);
  if (!normalizedSlug) {
    throw new ApiError('Slug is required', 400, 'VALIDATION_ERROR');
  }

  const privateAccess = await readPrivateAccessToken(normalizedSlug);
  const privateAccessHeaders = privateAccess?.token
    ? { 'x-card-access-token': privateAccess.token }
    : undefined;

  try {
    const direct = await apiClient.get<any>(`/directory/${encodeURIComponent(normalizedSlug)}`, {
      headers: privateAccessHeaders,
    });
    const mapped = mapResidentProfile(direct);

    if (mapped.isLocked) {
      await clearPrivateAccessToken(normalizedSlug);
      return mapped;
    }

    if (privateAccess?.token && mapped.privateAccessExpiresAt) {
      await writePrivateAccessToken(normalizedSlug, privateAccess.token, mapped.privateAccessExpiresAt);
    }

    return mapped;
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }
  }

  const [directory, contacts] = await Promise.all([
    fetchDirectoryLike(normalizedSlug, 1),
    fetchContactsLike(''),
  ]);

  const directoryItems = Array.isArray((directory as any)?.items) ? (directory as any).items : [];
  const contactItems = Array.isArray((contacts as any)?.items) ? (contacts as any).items : [];

  const matchDirectory = directoryItems.find(
    (item: any) => normalizeResidentSlug(item?.slug ?? item?.fullSlug) === normalizedSlug,
  );
  const matchContacts = contactItems.find(
    (item: any) => normalizeResidentSlug(item?.slug ?? item?.fullSlug) === normalizedSlug,
  );

  return mapResidentProfile({
    profile: {
      slug: normalizedSlug,
      name: matchDirectory?.name ?? matchContacts?.name ?? 'Unknown',
      avatarUrl: matchDirectory?.avatarUrl ?? matchContacts?.avatarUrl ?? undefined,
      address: matchDirectory?.address ?? '',
      city: matchDirectory?.city ?? '',
      tag: matchDirectory?.tag ?? matchContacts?.tag ?? 'basic',
      taps: Number(matchDirectory?.taps ?? matchContacts?.taps ?? 0),
      role: '',
      bio: '',
      email: '',
      phone: matchContacts?.phone ?? '',
      slugs: [normalizedSlug],
      buttons: [],
      saved: Boolean(matchDirectory?.saved ?? matchContacts?.saved),
      subscribed: Boolean(matchDirectory?.subscribed ?? matchContacts?.subscribed),
    },
  });
}

export async function unlockResidentPrivateProfileLike(slug: string, password: string): Promise<{ expiresAt: string | null }> {
  const normalizedSlug = normalizeResidentSlug(slug);
  const normalizedPassword = String(password ?? '').trim();
  if (!normalizedSlug || !normalizedPassword) {
    throw new ApiError('Slug and password are required', 400, 'VALIDATION_ERROR');
  }

  const payload = await apiClient.post<any>(`/directory/${encodeURIComponent(normalizedSlug)}/unlock`, {
    password: normalizedPassword,
  });

  const token = String(payload?.token ?? '').trim();
  const expiresAt = String(payload?.expiresAt ?? '').trim();

  if (token && expiresAt) {
    await writePrivateAccessToken(normalizedSlug, token, expiresAt);
    return { expiresAt };
  }

  await clearPrivateAccessToken(normalizedSlug);
  return { expiresAt: expiresAt || null };
}

export async function clearResidentPrivateAccessLike(slug: string): Promise<void> {
  const normalizedSlug = normalizeResidentSlug(slug);
  if (!normalizedSlug) return;
  await clearPrivateAccessToken(normalizedSlug);
}

export async function fetchPrivateAccessSettingsLike(): Promise<{
  passwords: Array<{ id: string; label: string; createdAt: string | null; lastUsedAt: string | null }>;
  logs: Array<{ id: string; slug: string; passwordLabel: string; device: string; userAgent: string | null; createdAt: string | null }>;
  minLength: number;
  limit: number;
}> {
  const [passwordsPayload, logsPayload] = await Promise.all([
    apiClient.get<any>('/profile/privacy/passwords'),
    apiClient.get<any>('/profile/privacy/access-logs', { query: { limit: 20 } }),
  ]);

  const passwords = Array.isArray(passwordsPayload?.items)
    ? passwordsPayload.items.map((item: any) => ({
      id: String(item?.id ?? ''),
      label: String(item?.label ?? ''),
      createdAt: item?.createdAt ? String(item.createdAt) : null,
      lastUsedAt: item?.lastUsedAt ? String(item.lastUsedAt) : null,
    })).filter((item: { id: string }) => Boolean(item.id))
    : [];

  const logs = Array.isArray(logsPayload?.items)
    ? logsPayload.items.map((item: any) => ({
      id: String(item?.id ?? ''),
      slug: normalizeResidentSlug(item?.slug),
      passwordLabel: String(item?.passwordLabel ?? ''),
      device: String(item?.device ?? ''),
      userAgent: item?.userAgent ? String(item.userAgent) : null,
      createdAt: item?.createdAt ? String(item.createdAt) : null,
    })).filter((item: { id: string }) => Boolean(item.id))
    : [];

  return {
    passwords,
    logs,
    minLength: Number(passwordsPayload?.minLength ?? 4) || 4,
    limit: Number(passwordsPayload?.limit ?? 10) || 10,
  };
}

export async function addPrivateAccessPasswordLike(input: { label?: string; password: string }): Promise<void> {
  await apiClient.post('/profile/privacy/passwords', {
    label: String(input.label ?? '').trim(),
    password: String(input.password ?? ''),
  });
}

export async function changePrivateAccessPasswordLike(input: { id: string; oldPassword: string; newPassword: string }): Promise<void> {
  await apiClient.post(`/profile/privacy/passwords/${encodeURIComponent(input.id)}/change`, {
    oldPassword: String(input.oldPassword ?? ''),
    newPassword: String(input.newPassword ?? ''),
  });
}

export async function deletePrivateAccessPasswordLike(id: string): Promise<void> {
  await apiClient.delete(`/profile/privacy/passwords/${encodeURIComponent(id)}`);
}

export async function saveContactLike(slug: string): Promise<unknown> {
  return apiClient.post(`/contacts/${encodeURIComponent(slug)}/save`, {});
}

export async function subscribeContactLike(slug: string): Promise<unknown> {
  return apiClient.post(`/contacts/${encodeURIComponent(slug)}/subscribe`, {});
}

export async function fetchProfileLike(): Promise<unknown> {
  const cached = readCache<unknown>('profile');
  if (cached) return cached;

  try {
    const bootstrap = await apiClient.get<any>('/profile/bootstrap');
    const effectivePlan = resolveEffectivePlan(bootstrap);
    if (effectivePlan === 'none') {
      return writeCache('profile', {
        ...bootstrap,
        card: null,
      });
    }

    if (bootstrap?.card) {
      return writeCache('profile', bootstrap);
    }

    try {
      const mePayload = await apiClient.get<any>('/me');
      const meUser = mePayload?.user ?? mePayload ?? null;
      const meCard = meUser?.card ?? mePayload?.card ?? null;
      const meSlugs = Array.isArray(mePayload?.slugs) ? mePayload.slugs : [];

      if (meUser || meCard) {
        return writeCache('profile', {
          ...bootstrap,
          user: {
            ...(bootstrap?.user ?? {}),
            ...(meUser ?? {}),
            card: meCard ?? bootstrap?.user?.card ?? null,
          },
          card: meCard ?? bootstrap?.card ?? null,
          slugs: Array.isArray(bootstrap?.slugs) && bootstrap.slugs.length > 0 ? bootstrap.slugs : meSlugs,
          selectedSlug: bootstrap?.selectedSlug ?? mePayload?.selectedSlug ?? null,
        });
      }
    } catch {
      // Non-fatal: profile bootstrap is still usable.
    }

    return writeCache('profile', bootstrap);
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }

    const bootstrap = await apiClient.getFirst<any>(['/profile/bootstrap', '/auth/me', '/me']);
    if (bootstrap?.card || bootstrap?.profileCard || bootstrap?.slugs) {
      return writeCache('profile', bootstrap);
    }

    if (bootstrap?.user) {
      return writeCache('profile', bootstrap);
    }

    return writeCache('profile', { user: bootstrap?.user ?? bootstrap });
  }
}

export async function saveProfileCardLike(card: ProfileCard): Promise<unknown> {
  const rawCard = card as any;
  const role = normalizeProfileString(rawCard?.job ?? rawCard?.role);
  const normalizedName = normalizeProfileString(card.name);
  const normalizedEmail = normalizeProfileString(card.email).toLowerCase();
  const normalizedPhone = normalizeProfileString(card.phone);
  const normalizedTheme = normalizeProfileString(card.theme);
  const tags = Array.isArray(rawCard?.tags)
    ? rawCard.tags.map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
    : (card.telegram ? [card.telegram] : []);

  const payload: Record<string, any> = {
    name: normalizedName,
    role,
    bio: normalizeProfileString(rawCard?.bio),
    hashtag: normalizeProfileString(rawCard?.hashtag),
    address: normalizeProfileString(rawCard?.address),
    postcode: normalizeProfileString(rawCard?.postcode),
    email: normalizedEmail || null,
    extraPhone: normalizeProfileString(rawCard?.extraPhone) || normalizedPhone,
    theme: normalizedTheme,
    customColor: normalizeProfileString(rawCard?.customColor),
    tags,
    showBranding: typeof rawCard?.showBranding === 'boolean' ? rawCard.showBranding : true,
  };

  if (Array.isArray(card.buttons) && card.buttons.length > 0) {
    payload.buttons = card.buttons
      .map((btn: any) => {
        const icon = String(btn?.icon ?? btn?.type ?? 'other');
        const label = String(btn?.label ?? '').trim();
        const url = String(btn?.url ?? btn?.value ?? btn?.href ?? '').trim();
        if (!label || !url) {
          return null;
        }
        const normalizedIcon = normalizeButtons([{ icon, label, url } as any])[0]?.type || 'other';
        return {
          icon: normalizedIcon,
          label,
          url,
        };
      })
      .filter((item: any) => Boolean(item));
  }

  try {
    // Prefer full profile endpoint: it supports independent role + bio.
    const saved = await apiClient.put('/profile/card', payload);
    const syncedAvatarUrl = await syncProfileAvatar(card.avatarUrl);
    if (syncedAvatarUrl !== undefined && saved && typeof saved === 'object') {
      const target = saved as Record<string, any>;
      if (target.card && typeof target.card === 'object') {
        target.card.avatarUrl = syncedAvatarUrl;
      }
    }
    invalidateCache(['profile', 'current-user']);
    return saved;
  } catch (error) {
    if (!shouldFallbackToMobileCardPatch(error)) {
      throw error;
    }

    // Legacy fallback for environments where /profile/card is unavailable.
    const patchCard: Record<string, any> = {
      name: normalizedName,
      job: normalizeProfileString(card.job),
      email: normalizedEmail || null,
      phone: normalizedPhone,
      telegram: normalizeProfileString(card.telegram),
      theme: normalizeLegacyMobileTheme(card.theme),
    };
    if (Array.isArray(card.buttons) && card.buttons.length > 0) {
      patchCard.buttons = card.buttons
        .map((btn: any) => {
          const icon = String(btn?.icon ?? btn?.type ?? 'other');
          const label = String(btn?.label ?? '').trim();
          const url = String(btn?.url ?? btn?.value ?? btn?.href ?? '').trim();
          if (!label || !url) {
            return null;
          }
          return { icon, label, url };
        })
        .filter((item: any) => Boolean(item));
    }
    const saved = await apiClient.patch('/me/card', patchCard);
    const syncedAvatarUrl = await syncProfileAvatar(card.avatarUrl);
    if (syncedAvatarUrl !== undefined && saved && typeof saved === 'object') {
      const target = saved as Record<string, any>;
      if (target.card && typeof target.card === 'object') {
        target.card.avatarUrl = syncedAvatarUrl;
      }
    }
    invalidateCache(['profile', 'current-user']);
    return saved;
  }
}

export async function createWristbandOrderLike(payload: { address: string; quantity: number }): Promise<unknown> {
  return apiClient.post<any>('/cards/order-request', {
    name: 'UNQX Wristband',
    letters: 'UNQ',
    digits: '001',
    tariff: 'basic',
    products: {
      digitalCard: false,
      bracelet: true,
    },
  });
}

export async function trackWristbandOrderLike(orderId: string): Promise<unknown> {
  try {
    return await apiClient.get<any>(`/orders/${encodeURIComponent(orderId)}/status`);
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }

    const requests = await apiClient.get<any>('/profile/requests');
    const list = Array.isArray(requests?.items) ? requests.items : [];
    const matched = list.find((item: any) => String(item?.id ?? item?.orderId ?? '') === String(orderId));
    return {
      order: {
        id: String(matched?.id ?? orderId),
        status: String(matched?.status ?? 'pending'),
        createdAt: matched?.createdAt,
        estimatedAt: matched?.purchasedAt,
      },
    };
  }
}

export async function fetchWristbandOrdersLike(): Promise<unknown> {
  const requests = await apiClient.get<any>('/profile/requests');
  const items = Array.isArray(requests?.items) ? requests.items : [];

  const isBraceletOrder = (item: any): boolean => {
    if (Boolean(item?.bracelet)) {
      return true;
    }

    const requestedPlan = String(item?.requestedPlan ?? '').toLowerCase();
    if (requestedPlan.includes('bracelet') || requestedPlan.includes('wristband')) {
      return true;
    }

    const products = Array.isArray(item?.products) ? item.products : [];
    return products.some((product: any) => {
      const type = String(product?.type ?? product?.name ?? '').toLowerCase();
      return type.includes('bracelet') || type.includes('wristband');
    });
  };

  return {
    items: items
      .filter((item: any) => isBraceletOrder(item))
      .map((item: any) => ({
        id: String(item?.id ?? ''),
        slug: item?.slug ? String(item.slug) : undefined,
        slugPrice: Number.isFinite(Number(item?.slugPrice)) ? Number(item.slugPrice) : undefined,
        requestedPlan: item?.requestedPlan ? String(item.requestedPlan) : undefined,
        planPrice: Number.isFinite(Number(item?.planPrice)) ? Number(item.planPrice) : undefined,
        bracelet: Boolean(item?.bracelet),
        status: String(item?.status ?? 'pending').toLowerCase(),
        statusBadge: item?.statusBadge ? String(item.statusBadge) : undefined,
        adminNote: item?.adminNote ? String(item.adminNote) : null,
        createdAt: item?.createdAt,
        estimatedAt: item?.purchasedAt,
      }))
      .filter((item: any) => item.id),
  };
}

export async function fetchNotificationsLike(): Promise<unknown> {
  const cached = readCache<unknown>('notifications');
  if (cached) return cached;

  try {
    return writeCache('notifications', await apiClient.get<any>('/notifications'));
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }
  }

  try {
    const requests = await apiClient.get<any>('/profile/requests');
    return writeCache('notifications', {
      items: (requests?.items ?? []).slice(0, 20).map((item: any, index: number) => ({
        id: item?.id ?? `req-${index}`,
        title: 'Заявка обновлена',
        subtitle: `${item?.slug ?? 'UNQ'} · ${item?.statusBadge ?? item?.status ?? 'new'}`,
        time: item?.createdAt ?? 'now',
        read: false,
        type: 'report',
      })),
    });
  } catch {
    return writeCache('notifications', { items: [] });
  }
}

export async function markNotificationsReadLike(): Promise<unknown> {
  try {
    return await apiClient.post<any>('/notifications/read-all', {});
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }

    return apiClient.patch<any>('/profile/welcome-dismiss', {});
  }
}
