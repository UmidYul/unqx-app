import { apiClient, ApiError } from '@/lib/apiClient';
import { resolveAssetUrl } from '@/lib/assetUrl';
import { ProfileCard, ResidentProfile } from '@/types';

const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

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

function isFallbackError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405 || error.status === 501);
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

function computeGrowthPercent(current: number, delta: number): number {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  const previous = safeCurrent - safeDelta;
  if (previous <= 0) {
    return safeCurrent > 0 ? 100 : 0;
  }
  return Math.round((safeDelta / previous) * 100);
}

function mapByDayToSeries(items: unknown[], length: number): number[] {
  const values = Array.from({ length }, () => 0);
  const today = new Date();
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
    const d = new Date(today);
    d.setDate(today.getDate() - (length - 1 - i));
    const key = d.toISOString().slice(0, 10);
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

interface ProfileAnalyticsPayload {
  analytics: any;
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
    return { analytics };
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
    return writeCache('home-summary', await apiClient.get<any>('/analytics/summary'));
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }

    const profilePayload = await fetchProfileAnalyticsPayload(30);
    if (profilePayload) {
      const analytics = profilePayload.analytics;
      const kpi = analytics?.kpi ?? {};
      const byDay = Array.isArray(analytics?.chart?.viewsByDay) ? analytics.chart.viewsByDay : [];

      return writeCache('home-summary', {
        summary: {
          totalTaps: Number(kpi.views ?? 0),
          todayTaps: Number(byDay.at(-1)?.value ?? 0),
          growth: computeGrowthPercent(Number(kpi.views ?? 0), Number(kpi?.trends?.views ?? 0)),
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
    return writeCache('analytics-dashboard', await apiClient.get<any>('/analytics/summary'));
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

      return writeCache('analytics-dashboard', {
        summary: {
          totalTaps: totalViews,
          growth: computeGrowthPercent(totalViews, Number(analytics?.kpi?.trends?.views ?? 0)),
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
        growth: 0,
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

  try {
    const direct = await apiClient.get<any>(`/directory/${encodeURIComponent(normalizedSlug)}`);
    return mapResidentProfile(direct);
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

export async function saveContactLike(slug: string): Promise<unknown> {
  return apiClient.postFirst([`/contacts/${encodeURIComponent(slug)}/save`, `/cards/${encodeURIComponent(slug)}/view`], {});
}

export async function subscribeContactLike(slug: string): Promise<unknown> {
  return apiClient.postFirst([`/contacts/${encodeURIComponent(slug)}/subscribe`, `/cards/${encodeURIComponent(slug)}/view`], {});
}

export async function fetchProfileLike(): Promise<unknown> {
  const cached = readCache<unknown>('profile');
  if (cached) return cached;

  try {
    return writeCache('profile', await apiClient.get<any>('/profile/bootstrap'));
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
  try {
    return await apiClient.patch('/me/card', card);
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }

    const payload = {
      name: card.name,
      role: card.job,
      email: card.email || null,
      extraPhone: card.phone || null,
      theme: card.theme,
      buttons: normalizeButtons(card.buttons),
      tags: card.telegram ? [card.telegram] : [],
      bio: card.job,
      showBranding: true,
    };

    return apiClient.put('/profile/card', payload);
  }
}

export async function createWristbandOrderLike(payload: { address: string; quantity: number }): Promise<unknown> {
  try {
    return await apiClient.post<any>('/cards/order-request', {
      name: 'UNQX Wristband',
      letters: 'UNQ',
      digits: '001',
      tariff: 'basic',
      products: [{ type: 'bracelet', qty: Math.max(1, payload.quantity) }],
      address: payload.address,
    });
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error;
    }

    return apiClient.post<any>('/cards/order-request', {
      name: 'UNQX Wristband',
      letters: 'UNQ',
      digits: '001',
      tariff: 'basic',
      products: [{ type: 'bracelet', qty: Math.max(1, payload.quantity) }],
      address: payload.address,
    });
  }
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

  return {
    items: items
      .filter((item: any) => Boolean(item?.bracelet))
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
