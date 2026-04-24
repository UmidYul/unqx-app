export type ThemeMode = 'light' | 'dark';

export interface SurfacePreset {
  backgroundColor: string;
  borderColor: string;
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffsetY: number;
  elevation: number;
}

export interface AppDesignTokens {
  mode: ThemeMode;
  backdropStart: string;
  backdropEnd: string;
  backdropAccent: string;
  chromeSurface: SurfacePreset;
  elevatedSurface: SurfacePreset;
  floatingSurface: SurfacePreset;
  authSurface: SurfacePreset;
  chipSurface: SurfacePreset;
  navSurface: SurfacePreset;
  overlayStroke: string;
  overlayStrokeSoft: string;
  heroGradient: readonly [string, string, string];
  panelGradient: readonly [string, string];
  noiseTint: string;
  glowTint: string;
}

export interface ThemeTokens {
  bg: string;
  phoneBg: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
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
  glass: string;
  glassBorder: string;
  cardShadowColor: string;
  pageTint: string;
  overlayLine: string;
  overlaySoft: string;
  heroGradient: readonly [string, string, string];
  panelGradient: readonly [string, string];
}

export type ProfileCardTheme =
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

export interface CardThemeSpec {
  id: ProfileCardTheme;
  label: string;
  premium?: boolean;
  swatch: string;
  cardGradient: readonly string[];
  cardBg: string;
  surfaceBg: string;
  cardBorder: string;
  surfaceBorder: string;
  dividerColor: string;
  nameColor: string;
  roleColor: string;
  mutedColor: string;
  accentColor: string;
  emailColor: string;
  buttonPrimaryBg: string;
  buttonPrimaryGradient?: readonly string[];
  buttonPrimaryText: string;
  buttonPrimaryBorder: string;
  buttonSecondaryBg: string;
  buttonSecondaryGradient?: readonly string[];
  buttonSecondaryText: string;
  buttonSecondaryBorder: string;
  badgeText: string;
  badgeBg: string;
  badgeBorder: string;
  topLineColor: string;
  topLineGradient?: readonly string[];
  avatarBg: string;
  avatarGradient?: readonly string[];
  avatarText: string;
  avatarBorder: string;
  cardRadius: number;
  fontFamily: string;
  nameFontStyle: 'normal' | 'italic';
  nameFontWeight: '300' | '400' | '500' | '600' | '700' | '800';
  roleLetterSpacing: number;
  scoreLabelColor: string;
  scoreValueColor: string;
  scoreBarFill: string;
  scoreBarTrack: string;
  scorePercentileColor: string;
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffsetY: number;
  elevation: number;
  overlay:
    | 'none'
    | 'default_flow'
    | 'arctic_frost'
    | 'linen_stitch'
    | 'marble_veins'
    | 'forest_grain'
    | 'sage_geometry'
    | 'midnight_constellation'
    | 'noir_gold_dust'
    | 'codex_corner_lines'
    | 'velvet_weave';
  buttonShine: boolean;
  footerText: string;
  widgetPrimary: string;
  widgetSecondary: string;
  widgetAccent: string;
}

export type CardThemeRegistry = Record<ProfileCardTheme, CardThemeSpec>;

export type ScreenTab = 'home' | 'nfc' | 'people' | 'analytics' | 'profile';

export type NfcPayloadKind = 'url' | 'text' | 'unknown';
export type NfcTemplateId =
  | 'slug'
  | 'telegram'
  | 'instagram'
  | 'site'
  | 'tiktok'
  | 'whatsapp'
  | 'phone'
  | 'email'
  | 'plain_text';

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
  payloadKind?: NfcPayloadKind;
  payloadValue?: string;
  displayValue?: string;
  slug?: string;
  isLocked?: boolean;
}

export interface NFCHistoryItem {
  id: string;
  slug?: string;
  uid?: string;
  type: 'read' | 'write' | 'verify' | 'lock';
  timestamp: string;
  payloadKind?: NfcPayloadKind;
  payloadValue?: string;
  displayValue?: string;
  templateId?: NfcTemplateId;
}

export interface NfcWritablePayload {
  kind: Exclude<NfcPayloadKind, 'unknown'>;
  value: string;
  displayValue?: string;
  slug?: string;
  templateId?: NfcTemplateId;
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
  theme: ProfileCardTheme;
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
