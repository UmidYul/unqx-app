export type ApiQueryValue = string | number | boolean | null | undefined;

const DEFAULT_API_ORIGIN = "https://unqx.uz";
const DEFAULT_API_PREFIX = "/api";

function normalizeApiOrigin(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) {
    return DEFAULT_API_ORIGIN;
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
}

function normalizeApiPrefix(value: string | undefined): string {
  const raw = String(value || "").trim();
  const prefixed = raw ? (raw.startsWith("/") ? raw : `/${raw}`) : DEFAULT_API_PREFIX;
  return prefixed.replace(/\/+$/, "") || DEFAULT_API_PREFIX;
}

function normalizePath(path: string): string {
  const raw = String(path || "").trim();
  if (!raw) return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function buildQuery(params?: Record<string, ApiQueryValue>): string {
  if (!params) return "";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export const API_ORIGIN = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_ORIGIN ?? process.env.EXPO_PUBLIC_API_URL);
export const API_PREFIX = normalizeApiPrefix(process.env.EXPO_PUBLIC_API_PREFIX);
export const API_BASE_URL = `${API_ORIGIN}${API_PREFIX}`;

export function buildApiUrl(path: string, query?: Record<string, ApiQueryValue>): string {
  return `${API_BASE_URL}${normalizePath(path)}${buildQuery(query)}`;
}

export const API_PATHS = {
  auth: {
    register: "/auth/register",
    checkAvailability: "/auth/check-availability",
    login: "/auth/login",
    logout: "/auth/logout",
    me: "/auth/me",
    sendOtp: "/auth/send-otp",
    verifyEmail: "/auth/verify-email",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
  },
  profile: {
    bootstrap: "/profile/bootstrap",
    settings: "/profile/settings",
    deactivate: "/profile/deactivate",
    card: "/profile/card",
    cardAvatar: "/profile/card/avatar",
    slugs: "/profile/slugs",
    slugStatus: (slug: string) => `/profile/slugs/${encodeURIComponent(slug)}/status`,
    slugPrimary: (slug: string) => `/profile/slugs/${encodeURIComponent(slug)}/primary`,
    slugPauseMessage: (slug: string) => `/profile/slugs/${encodeURIComponent(slug)}/pause-message`,
    slugQr: (slug: string) => `/profile/slugs/${encodeURIComponent(slug)}/qr`,
    analyticsBootstrap: "/profile/analytics/bootstrap",
    analytics: "/profile/analytics",
    verification: "/profile/verification",
    verificationRequest: "/profile/verification-request",
    welcomeDismiss: "/profile/welcome-dismiss",
  },
  cards: {
    search: "/cards/search",
    availability: "/cards/availability",
    waitlist: "/cards/waitlist",
    slugCounter: "/cards/slug-counter",
    slugSuggestions: "/cards/slug-suggestions",
    slugPrice: "/cards/slug-price",
    pricing: "/cards/pricing",
    slugPricingConfig: "/cards/slug-pricing-config",
    orderRequest: "/cards/order-request",
    click: (slug: string) => `/cards/${encodeURIComponent(slug)}/click`,
    view: (slug: string) => `/cards/${encodeURIComponent(slug)}/view`,
    vcf: (slug: string) => `/cards/${encodeURIComponent(slug)}/vcf`,
  },
  features: {
    liveStats: "/public/live-stats",
    leaderboard: "/leaderboard",
    leaderboardMe: "/leaderboard/me",
    flashSale: "/flash-sale/active",
    drops: "/drops",
    dropDetails: (id: string) => `/drops/${encodeURIComponent(id)}`,
    dropLive: (id: string) => `/drops/${encodeURIComponent(id)}/live`,
    dropWaitlist: (id: string) => `/drops/${encodeURIComponent(id)}/waitlist`,
    referralsBootstrap: "/referrals/bootstrap",
    claimReward: (rewardRuleId: string) => `/referrals/rewards/${encodeURIComponent(rewardRuleId)}/claim`,
  },
  telegram: {
    webhook: "/telegram/webhook",
  },
} as const;
