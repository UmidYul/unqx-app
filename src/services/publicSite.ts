import { HTMLElement, parse } from 'node-html-parser';

import { API_ORIGIN, API_PATHS, buildApiUrl } from '@/config/api';
import { resolveAssetUrl } from '@/lib/assetUrl';
import { ApiError } from '@/lib/apiClient';
import { captureSentryException } from '@/lib/sentry';
import {
  FaqItem,
  FeaturedProfile,
  FooterLink,
  LatestCreatedCard,
  LatestHomePost,
  OfficialSlugConfig,
  PublicFooter,
  PublicHeroSearch,
  PublicHomePayload,
  PublicLiveStats,
  PublicSlugCounter,
  StickerOffer,
  WeeklyTopCard,
} from '@/types';
import { extractSlug } from '@/utils/links';

interface JsonFetchOptions {
  timeoutMs?: number;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export interface PublicSlugAvailability {
  slug: string;
  validFormat: boolean;
  available: boolean;
  reason: string;
  owner?: {
    name?: string;
    avatarUrl?: string;
    href?: string;
  } | null;
  suggestions: string[];
}

export interface PublicSlugAvailabilityBulkItem {
  slug: string;
  validFormat: boolean;
  available: boolean;
  reason: string;
}

export interface PublicSlugPrice {
  slug: string;
  validFormat: boolean;
  price: number;
  basePrice?: number;
  calculatedPrice?: number;
  hasFlashSale?: boolean;
  discountAmount?: number;
  discountPercent?: number;
  source?: string;
  calculation?: {
    basePrice?: number;
    lettersMultiplier?: number;
    digitsMultiplier?: number;
    multipliedBase?: number;
    customDeltaTotal?: number;
    customBreakdown?: Array<{
      label?: string;
      delta?: number;
      pattern?: string;
      type?: string;
    }>;
  } | null;
}

export interface PublicSlugPricingConfig {
  basePrice?: number;
  lettersAllSame?: number;
  lettersSequential?: number;
  lettersPalindrome?: number;
  lettersRandom?: number;
  digitsZeros?: number;
  digitsNearZero?: number;
  digitsAllSame?: number;
  digitsSequential?: number;
  digitsRound?: number;
  digitsPalindrome?: number;
  digitsRandom?: number;
  customRules?: Array<{
    pattern: string;
    type?: string;
    delta?: number;
    label?: string;
  }>;
}

function cleanText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(value: string | null | undefined): string | undefined {
  const raw = cleanText(value);
  if (!raw) {
    return undefined;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  try {
    return new URL(raw, API_ORIGIN).toString();
  } catch {
    return resolveAssetUrl(raw) ?? raw;
  }
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

function firstText(node: HTMLElement | null | undefined, selector: string): string {
  return cleanText(node?.querySelector(selector)?.text);
}

function attr(node: HTMLElement | null | undefined, name: string): string {
  return cleanText(node?.getAttribute(name));
}

async function fetchText(url: string, timeoutMs = 10_000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(`Failed to fetch ${url}`, response.status, 'PUBLIC_SITE_FETCH_FAILED');
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(path: string, options?: JsonFetchOptions): Promise<T> {
  const url = buildApiUrl(path, options?.query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 10_000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(`Failed to fetch ${path}`, response.status, 'PUBLIC_API_FETCH_FAILED');
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function parseHeroSearch(root: HTMLElement, initialSlug?: string): PublicHeroSearch {
  const title = firstText(root, 'section h1') || 'Твой UNQ. Твой бренд. Навсегда.';
  const subtitle = cleanText(root.querySelector('section h1 + p')?.text)
    || 'Цифровая визитка за 1 минуту — одна ссылка вместо тысячи слов.';
  const placeholder = attr(root.querySelector('#home-slug-input'), 'placeholder') || 'AAA001';
  const checkLabel = cleanText(root.querySelector('#home-slug-check')?.text) || 'Проверить';
  const primaryActionLabel = cleanText(root.querySelector('#home-slug-primary-action')?.text) || 'Купить';
  const secondaryActionLabel = cleanText(root.querySelector('#home-slug-calculator-action')?.text) || 'Узнать цену';

  return {
    title,
    subtitle,
    placeholder,
    checkLabel,
    primaryActionLabel,
    secondaryActionLabel,
    initialSlug,
  };
}

function parseFeaturedProfiles(root: HTMLElement): FeaturedProfile[] {
  return root.querySelectorAll('.home-profile-marquee-item')
    .slice(0, 30)
    .map((item) => {
      const href = attr(item, 'href');
      const slug = extractSlug(href) ?? extractSlug(item.text) ?? '';
      if (!slug) {
        return null;
      }
      const name = firstText(item, 'p');
      const avatar = item.querySelector('img');
      const initials = cleanText(item.querySelector('.home-profile-marquee-avatar-fallback')?.text)
        || name.slice(0, 1).toUpperCase();
      return {
        slug,
        href: absoluteUrl(href) ?? `${API_ORIGIN}/${slug}`,
        name: name || slug,
        avatarUrl: absoluteUrl(attr(avatar, 'src')),
        initials,
      };
    })
    .filter(isDefined);
}

function parseLatestPosts(root: HTMLElement): LatestHomePost[] {
  return root.querySelectorAll('[data-home-post-card]')
    .slice(0, 12)
    .map((card) => {
      const postHref = attr(card, 'data-post-href');
      const likeButton = card.querySelector('[data-home-post-like]');
      const commentButton = card.querySelector('[data-home-post-comment]');
      const followButton = card.querySelector('[data-home-follow-button]');
      const authorLink = card.querySelector('.home-latest-post-author');
      const authorImage = authorLink?.querySelector('img');
      const likeValue = Number(attr(likeButton, 'data-likes-count') || firstText(likeButton, '[data-home-post-like-count]') || '0');
      const commentsValue = Number(firstText(commentButton, '.home-latest-post-action-value') || '0');
      const slug = attr(likeButton, 'data-post-slug') || extractSlug(postHref) || extractSlug(attr(authorLink, 'href')) || '';

      if (!slug) {
        return null;
      }

      return {
        id: attr(likeButton, 'data-post-id') || attr(card, 'data-post-id') || postHref.split('#wall-post-').at(-1) || `${slug}-${likeValue}`,
        slug,
        href: absoluteUrl(postHref) ?? `${API_ORIGIN}/${slug}`,
        commentsHref: absoluteUrl(attr(commentButton, 'data-post-comments-href')),
        shareHref: absoluteUrl(attr(card.querySelector('[data-home-post-share]'), 'data-post-href') || postHref),
        authorName: firstText(card, '.home-latest-post-author-name') || slug,
        authorSlug: firstText(card, '.home-latest-post-author-slug') || `unqx.uz/${slug}`,
        authorAvatarUrl: absoluteUrl(attr(authorImage, 'src')),
        authorInitials: cleanText(authorLink?.querySelector('span')?.text).slice(0, 2).toUpperCase() || slug.slice(0, 1),
        authorVerified: Boolean(authorLink?.querySelector('svg')),
        content: firstText(card, '.home-latest-post-content'),
        publishedAtLabel: firstText(card, '.home-latest-post-date'),
        likesCount: Number.isFinite(likeValue) ? likeValue : 0,
        commentsCount: Number.isFinite(commentsValue) ? commentsValue : 0,
        viewerHasLiked: attr(likeButton, 'data-liked') === 'true',
        viewerIsFollowing: attr(followButton, 'data-following') === 'true',
        loginNext: attr(followButton, 'data-login-next') || attr(likeButton, 'data-login-next'),
      };
    })
    .filter(isDefined);
}

function parseLatestCreated(root: HTMLElement): LatestCreatedCard[] {
  return root.querySelectorAll('.home-latest-card')
    .slice(0, 12)
    .map((card) => {
      const href = attr(card, 'href') || attr(card.querySelector('a'), 'href');
      const slug = extractSlug(href) ?? extractSlug(firstText(card, '.home-latest-card-slug')) ?? '';
      if (!slug) {
        return null;
      }
      return {
        slug,
        href: absoluteUrl(href) ?? `${API_ORIGIN}/${slug}`,
        rank: firstText(card, '.home-latest-rank'),
        dateLabel: firstText(card, '.home-latest-card-date'),
        name: firstText(card, '.home-latest-card-name') || slug,
        avatarUrl: absoluteUrl(attr(card.querySelector('.home-latest-card-identity img'), 'src') || attr(card.querySelector('img'), 'src')),
        initials: cleanText(card.querySelector('.home-latest-card-name')?.text).slice(0, 2).toUpperCase() || slug.slice(0, 2).toUpperCase(),
        role: firstText(card, '.home-latest-card-role'),
        kind: firstText(card, '.home-latest-card-kind'),
        bio: firstText(card, '.home-latest-card-bio'),
      };
    })
    .filter(isDefined);
}

function parseWeeklyTop(root: HTMLElement): WeeklyTopCard[] {
  return root.querySelectorAll('.home-weekly-card')
    .slice(0, 12)
    .map((card) => {
      const href = attr(card, 'href') || attr(card.querySelector('a'), 'href');
      const slug = extractSlug(href) ?? extractSlug(card.text) ?? '';
      if (!slug) {
        return null;
      }
      const name = firstText(card, '.home-weekly-card-name') || slug;
      return {
        slug,
        href: absoluteUrl(href) ?? `${API_ORIGIN}/${slug}`,
        name,
        avatarUrl: absoluteUrl(attr(card.querySelector('.home-weekly-card-avatar img'), 'src') || attr(card.querySelector('img'), 'src')),
        initials: cleanText(card.querySelector('.home-weekly-card-avatar')?.text).slice(0, 2).toUpperCase() || name.slice(0, 1).toUpperCase(),
        rankLabel: firstText(card, '.home-weekly-card-rank'),
        viewsLabel: firstText(card, '.home-weekly-card-views-badge'),
        verified: Boolean(card.querySelector('.home-weekly-card-verified')),
      };
    })
    .filter(isDefined);
}

function parseFaq(root: HTMLElement): FaqItem[] {
  return root.querySelectorAll('#faq details')
    .map((item) => {
      const question = firstText(item, 'summary');
      const answer = cleanText(item.querySelector('p')?.text);
      if (!question || !answer) {
        return null;
      }
      return { question, answer };
    })
    .filter((item): item is FaqItem => item !== null);
}

function parseStickerOffer(root: HTMLElement): StickerOffer | null {
  const section = root.querySelector('#wristband');
  if (!section) {
    return null;
  }

  const points = section.querySelectorAll('li').map((item) => cleanText(item.text)).filter(Boolean);
  return {
    eyebrow: firstText(section, 'p') || 'UNQX STICKER',
    title: firstText(section, 'h2'),
    description: cleanText(section.querySelector('h2 + p')?.text),
    oldPrice: cleanText(section.querySelector('span.line-through')?.text),
    price: cleanText(section.querySelector('.text-3xl.font-bold')?.text),
    discountBadge: cleanText(section.querySelector('.bg-emerald-100')?.text),
    availabilityLabel: cleanText(section.querySelector('.inline-flex.items-center.gap-1\\.5')?.text),
    metaLabel: cleanText(section.querySelector('.mt-2.text-sm')?.text),
    points,
    note: cleanText(section.querySelector('.mt-3.text-xs')?.text),
    imageUrl: absoluteUrl(attr(section.querySelector('img'), 'src')),
    ctaLabel: cleanText(section.querySelector('[data-order-bracelet="true"]')?.text) || 'Заказать стикер',
  };
}

function parseFooter(root: HTMLElement): PublicFooter | null {
  const footer = root.querySelector('footer');
  if (!footer) {
    return null;
  }

  const links: FooterLink[] = footer.querySelectorAll('a[href]')
    .map((item) => ({
      label: cleanText(item.text),
      href: absoluteUrl(attr(item, 'href')) ?? '#',
    }))
    .filter((item) => item.label && !item.href.startsWith('tel:') && !item.label.includes('UNQX'));

  const phoneLink = footer.querySelector('a[href^="tel:"]');
  return {
    tagline: cleanText(footer.querySelector('p.mt-2')?.text) || 'Цифровая визитка нового поколения',
    links,
    phoneLabel: cleanText(phoneLink?.text),
    phoneHref: attr(phoneLink, 'href') || undefined,
    copyright: cleanText(footer.querySelector('.mt-12 p:last-child')?.text),
  };
}

function parseOfficialConfig(html: string): OfficialSlugConfig | null {
  const configMatch = html.match(/__UNQ_OFFICIAL_CLIENT_CONFIG\s*=\s*(\{[\s\S]*?\});/);
  const lettersMatch = html.match(/UNQOfficialLetters\s*=\s*(\[[\s\S]*?\]);/);

  try {
    const config = configMatch?.[1] ? JSON.parse(configMatch[1]) as Record<string, unknown> : null;
    const letters = lettersMatch?.[1] ? JSON.parse(lettersMatch[1]) as unknown[] : [];
    if (!config && letters.length === 0) {
      return null;
    }
    const notices = Array.isArray(config?.notices)
      ? config.notices.map((item) => {
        const source = item as Record<string, unknown>;
        return {
          pattern: cleanText(source.pattern as string),
          title: cleanText(source.title as string) || undefined,
          body: cleanText(source.body as string) || undefined,
          tone: cleanText(source.tone as string) || undefined,
        };
      }).filter((item) => item.pattern)
      : [];
    return {
      letters: Array.isArray(letters) ? letters.map((item) => cleanText(String(item))).filter(Boolean) : undefined,
      notices,
    };
  } catch (error) {
    captureSentryException(error, {
      tags: { area: 'public-home-parser', section: 'official-config' },
      extra: { hasConfig: Boolean(configMatch?.[1]), hasLetters: Boolean(lettersMatch?.[1]) },
    });
    return null;
  }
}

function parseSectionSafely<T>(section: string, parser: () => T, fallback: T): T {
  try {
    return parser();
  } catch (error) {
    captureSentryException(error, {
      tags: { area: 'public-home-parser', section },
    });
    return fallback;
  }
}

export async function fetchPublicLiveStatsLike(): Promise<PublicLiveStats> {
  const payload = await fetchJson<Record<string, unknown>>(API_PATHS.features.liveStats);
  return {
    activeCardsTotal: Number(payload.activeCardsTotal ?? 0),
    todayCreated: Number(payload.todayCreated ?? 0),
    todayActivated: Number(payload.todayActivated ?? 0),
    todayTotal: Number(payload.todayTotal ?? 0),
    todayVisitors: Number(payload.todayVisitors ?? 0),
  };
}

export async function fetchPublicSlugCounterLike(): Promise<PublicSlugCounter> {
  const payload = await fetchJson<Record<string, unknown>>(API_PATHS.cards.slugCounter);
  return {
    taken: Number(payload.taken ?? 0),
    total: Number(payload.total ?? 0),
  };
}

export async function fetchSlugAvailabilityLike(slug: string, source = 'hero'): Promise<PublicSlugAvailability> {
  const payload = await fetchJson<Record<string, unknown>>(API_PATHS.cards.availability, {
    query: { slug, source },
  });
  const owner = payload.owner && typeof payload.owner === 'object' ? payload.owner as Record<string, unknown> : null;
  return {
    slug: cleanText(String(payload.slug ?? slug)).toUpperCase(),
    validFormat: payload.validFormat === true,
    available: payload.available === true,
    reason: cleanText(String(payload.reason ?? '')),
    owner: owner ? {
      name: cleanText(String(owner.name ?? '')) || undefined,
      avatarUrl: absoluteUrl(String(owner.avatarUrl ?? '')),
      href: absoluteUrl(String(owner.href ?? '')),
    } : null,
    suggestions: Array.isArray(payload.suggestions)
      ? payload.suggestions.map((item) => cleanText(String(item)).toUpperCase()).filter(Boolean)
      : [],
  };
}

export async function fetchSlugAvailabilityBulkLike(
  slugs: string[],
  source = 'calculator_generate',
): Promise<PublicSlugAvailabilityBulkItem[]> {
  const normalized = Array.from(new Set(slugs.map((item) => cleanText(item).toUpperCase()).filter(Boolean)));
  const payload = await fetchJson<Record<string, unknown>>(API_PATHS.cards.availabilityBulk, {
    query: {
      slugs: normalized.join(','),
      source,
    },
  });
  return Array.isArray(payload.items)
    ? payload.items.map((item) => {
      const sourceItem = item as Record<string, unknown>;
      return {
        slug: cleanText(String(sourceItem.slug ?? '')).toUpperCase(),
        validFormat: sourceItem.validFormat === true,
        available: sourceItem.available === true,
        reason: cleanText(String(sourceItem.reason ?? '')),
      };
    }).filter((item) => item.slug)
    : [];
}

export async function fetchSlugPriceLike(slug: string): Promise<PublicSlugPrice> {
  const payload = await fetchJson<Record<string, unknown>>(API_PATHS.cards.slugPrice, {
    query: { slug },
  });
  return {
    slug: cleanText(String(payload.slug ?? slug)).toUpperCase(),
    validFormat: payload.validFormat === true,
    price: Number(payload.price ?? 0),
    basePrice: Number(payload.basePrice ?? 0) || undefined,
    calculatedPrice: Number(payload.calculatedPrice ?? 0) || undefined,
    hasFlashSale: payload.hasFlashSale === true,
    discountAmount: Number(payload.discountAmount ?? 0) || undefined,
    discountPercent: Number(payload.discountPercent ?? 0) || undefined,
    source: cleanText(String(payload.source ?? '')) || undefined,
    calculation: payload.calculation && typeof payload.calculation === 'object'
      ? payload.calculation as PublicSlugPrice['calculation']
      : null,
  };
}

export async function fetchSlugPricingConfigLike(): Promise<PublicSlugPricingConfig> {
  return fetchJson<PublicSlugPricingConfig>(API_PATHS.cards.slugPricingConfig, {
    query: { _: Date.now() },
  });
}

export async function fetchRandomFreeSlugLike(): Promise<string> {
  const payload = await fetchJson<Record<string, unknown>>(API_PATHS.cards.randomFreeSlug, {
    query: { _: Date.now() },
  });
  return cleanText(String(payload.slug ?? '')).toUpperCase();
}

export async function fetchAffordableSlugLike(): Promise<string> {
  const payload = await fetchJson<Record<string, unknown>>(API_PATHS.cards.slugGenerateAffordable, {
    query: { source: 'calculator_generate' },
  });
  return cleanText(String(payload.slug ?? '')).toUpperCase();
}

export async function fetchPublicHomeLike(): Promise<PublicHomePayload> {
  const [html, liveStatsResult, slugCounterResult, randomSlugResult] = await Promise.all([
    fetchText(API_ORIGIN),
    fetchPublicLiveStatsLike().catch(() => null),
    fetchPublicSlugCounterLike().catch(() => null),
    fetchRandomFreeSlugLike().catch(() => ''),
  ]);

  const root = parse(html);
  const heroSearch = parseSectionSafely('hero', () => parseHeroSearch(root, randomSlugResult || undefined), {
    title: 'Твой UNQ. Твой бренд. Навсегда.',
    subtitle: 'Цифровая визитка за 1 минуту — одна ссылка вместо тысячи слов.',
    placeholder: 'AAA001',
    checkLabel: 'Проверить',
    primaryActionLabel: 'Купить',
    secondaryActionLabel: 'Узнать цену',
    initialSlug: randomSlugResult || undefined,
  });

  return {
    liveStats: liveStatsResult,
    slugCounter: slugCounterResult,
    heroSearch,
    featuredProfiles: parseSectionSafely('featured-profiles', () => parseFeaturedProfiles(root), []),
    latestPosts: parseSectionSafely('latest-posts', () => parseLatestPosts(root), []),
    latestCreated: parseSectionSafely('latest-created', () => parseLatestCreated(root), []),
    weeklyTop: parseSectionSafely('weekly-top', () => parseWeeklyTop(root), []),
    stickerOffer: parseSectionSafely('wristband', () => parseStickerOffer(root), null),
    faq: parseSectionSafely('faq', () => parseFaq(root), []),
    footer: parseSectionSafely('footer', () => parseFooter(root), null),
    officialConfig: parseSectionSafely('official-config', () => parseOfficialConfig(html), null),
  };
}
