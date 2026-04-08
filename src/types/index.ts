export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  bg: string;
  phoneBg: string;
  surface: string;
  border: string;
  borderStrong: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentText: string;
  green: string;
  greenBg: string;
  amber: string;
  amberBg: string;
  red: string;
  blue: string;
  blueBg: string;
  tabActiveBg: string;
  tabActiveText: string;
  tabInactive: string;
  navBorder: string;
  inputBg: string;
}

export type ScreenTab = 'home' | 'nfc' | 'people' | 'analytics' | 'profile';

export type NFCState =
  | 'idle'
  | 'scanning'
  | 'success'
  | 'writing'
  | 'written'
  | 'verifying'
  | 'verified'
  | 'locking'
  | 'locked';

export interface NFCTag {
  uid?: string;
  type?: string;
  capacity?: number;
  used?: number;
  url?: string;
  isLocked?: boolean;
}

export interface NFCHistoryItem {
  id: string;
  slug: string;
  uid?: string;
  type: 'read' | 'write' | 'verify' | 'lock';
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  read: boolean;
  type: 'tap' | 'write' | 'report' | 'elite' | 'system';
}

export interface ApiError {
  status: number;
  message: string;
  code: string | null;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

export interface HomeUser {
  id?: string;
  name: string;
  slug: string;
  plan: 'basic' | 'premium' | string;
}

export type TapSource = 'nfc' | 'qr' | 'direct' | 'share' | 'widget';

export interface SourceStat {
  source: TapSource;
  count: number;
  percent: number;
}

export interface GeoPoint {
  city: string;
  x: number;
  y: number;
  r: number;
  value?: number;
}

export interface AnalyticsSummary {
  totalTaps: number;
  todayTaps?: number;
  weekTaps?: number[];
  monthTaps?: number[];
  growth?: number;
  sources?: SourceStat[];
  geo?: GeoPoint[];
}

export interface RecentTap {
  id: string;
  name: string;
  slug?: string;
  time: string;
  source?: string;
}

export interface Contact {
  name: string;
  slug: string;
  avatarUrl?: string;
  phone?: string;
  taps?: number;
  tag?: 'premium' | 'basic' | string;
  lastSeen?: string;
  saved?: boolean;
  subscribed?: boolean;
  email?: string;
  telegram?: string;
  verified?: boolean;
  verifiedCompany?: string;
}

export interface Resident {
  name: string;
  slug: string;
  slugs?: string[];
  avatarUrl?: string;
  city?: string;
  verified?: boolean;
  verifiedCompany?: string;
  tag?: 'premium' | 'basic' | string;
  taps?: number;
  subscribed?: boolean;
  saved?: boolean;
}

export interface ResidentProfile {
  name: string;
  slug: string;
  slugs: string[];
  slugPrice?: number;
  totalSlugsPrice?: number;
  postcode?: string;
  hashtag?: string;
  tags?: string[];
  avatarUrl?: string;
  address?: string;
  city?: string;
  tag?: 'premium' | 'basic' | string;
  plan?: string;
  taps?: number;
  score?: number;
  topPercent?: number;
  leaderboardPosition?: number;
  scoreProgress?: number;
  rarity?: string;
  role?: string;
  bio?: string;
  email?: string;
  phone?: string;
  buttons?: Array<{
    icon?: string;
    label: string;
    url: string;
  }>;
  saved?: boolean;
  subscribed?: boolean;
  username?: string;
  verified?: boolean;
  verifiedCompany?: string;
  theme?: string;
  isPrivate?: boolean;
  isLocked?: boolean;
  lockedMessage?: string;
  privateAccessExpiresAt?: string | null;
}

export interface PrivateAccessPassword {
  id: string;
  label?: string;
  createdAt?: string | null;
  lastUsedAt?: string | null;
}

export interface PrivateAccessLog {
  id: string;
  slug: string;
  passwordLabel?: string;
  device?: string;
  userAgent?: string | null;
  createdAt?: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  slug: string;
  avatarUrl?: string;
  taps: number;
  delta: number;
  score?: number;
  topPercent?: number;
  verifiedCompany?: string;
}

export interface CardButton {
  icon: string;
  label: string;
  url: string;
}

export interface ProfileCard {
  name: string;
  job: string;
  bio?: string;
  hashtag?: string;
  address?: string;
  postcode?: string;
  extraPhone?: string;
  tags?: string[];
  showBranding?: boolean;
  phone: string;
  telegram: string;
  email: string;
  slug: string;
  avatarUrl?: string;
  theme:
  | 'default_dark'
  | 'arctic'
  | 'linen'
  | 'marble'
  | 'forest'
  | 'sage_luxe'
  | 'midnight_obsidian'
  | 'golden_noir'
  | 'aurora_codex'
  | 'nebula_glass'
  | 'velours';
  buttons: CardButton[];
}

export interface WristbandStatus {
  status: string;
  model?: string;
  linkedSlug?: string;
  orderId?: string;
}

export interface WristbandOrder {
  id: string;
  status: string;
  createdAt?: string;
  estimatedAt?: string;
  slug?: string;
  slugPrice?: number;
  requestedPlan?: string;
  planPrice?: number;
  bracelet?: boolean;
  statusBadge?: string;
  adminNote?: string | null;
}
