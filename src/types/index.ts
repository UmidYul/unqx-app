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
  | 'velours'
  | 'graffiti_neon'
  | 'color_red'
  | 'color_orange'
  | 'color_yellow'
  | 'color_green'
  | 'color_teal'
  | 'color_blue'
  | 'color_purple'
  | 'color_pink';

export type ProfileCardAvatarFrame =
  | 'none'
  | 'chrome_ring'
  | 'neon_spray'
  | 'sticker_bubble'
  | 'chain_link'
  | 'pixel_glow'
  | 'starburst'
  | 'drip_outline'
  | 'tape_collage'
  | 'orbit_dots';

export type ProfileCardEmojiBackgroundPack =
  | 'none'
  | 'ghosts'
  | 'stars'
  | 'lightning'
  | 'crowns'
  | 'webs'
  | 'hearts';

export type ProfileCardPetType = 'kitten' | 'puppy' | 'snake';

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
    | 'velvet_weave'
    | 'graffiti_chaos'
    | 'monochrome_flow';
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

export interface ViewerCommentComposer {
  avatarUrl?: string;
  initials?: string;
  placeholder?: string;
}

export interface WallCommentAuthor {
  id?: string;
  name: string;
  wallAuthorLabel?: string;
  verified?: boolean;
  profileHref?: string;
  primarySlug?: string;
  avatarUrl?: string;
  initials?: string;
}

export interface WallComment {
  id: string;
  postId?: string;
  userId?: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  isEdited?: boolean;
  viewerCanDelete?: boolean;
  author: WallCommentAuthor;
}

export interface WallPost {
  id: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  commentsEnabled: boolean;
  likesCount: number;
  commentsCount: number;
  comments: WallComment[];
  viewerHasLiked: boolean;
  viewerCanLike: boolean;
  viewerCanComment?: boolean;
  viewerCanEdit?: boolean;
  viewerCanDelete?: boolean;
  isEdited?: boolean;
}

export interface WallPagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface WallFeed {
  enabled: boolean;
  items: WallPost[];
  pagination: WallPagination;
}

export interface FollowListItem {
  userId?: string;
  name: string;
  initials?: string;
  avatarUrl?: string;
  primarySlug?: string;
  role?: string;
  verified?: boolean;
  followedAt?: string;
  isFollowing?: boolean;
  canFollow?: boolean;
  requiresAuth?: boolean;
  isPubliclyReachable?: boolean;
  profileHref?: string;
}

export interface FollowSummary {
  counts: {
    followers: number;
    following: number;
  };
  viewer: {
    isFollowing: boolean;
    canFollow: boolean;
    requiresAuth: boolean;
  };
  unreadFollowersCount?: number;
  previews: {
    following: FollowListItem[];
    followers?: FollowListItem[];
  };
}

export interface PublicProfileBadge {
  label: string;
  shortLabel?: string;
  tone?: string;
  description?: string;
  periodLabel?: string;
  rank?: number;
}

export interface ResidentPausedState {
  active: boolean;
  label?: string;
  message?: string;
  resumeAt?: string | null;
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
  theme?: ProfileCardTheme;
  avatarFrame?: ProfileCardAvatarFrame;
  emojiBackgroundPack?: ProfileCardEmojiBackgroundPack;
  pets?: ProfileCardPet[];
  showBranding?: boolean;
  isPrivate?: boolean;
  isLocked?: boolean;
  lockedMessage?: string;
  privateAccessExpiresAt?: string | null;
  wall?: WallFeed | null;
  followSummary?: FollowSummary;
  viewerCommentComposer?: ViewerCommentComposer | null;
  topBadge?: PublicProfileBadge | null;
  officialUnqBadge?: PublicProfileBadge | null;
  staffBadge?: PublicProfileBadge | null;
  shareUrl?: string;
  viewsLabel?: string;
  paused?: ResidentPausedState | null;
  trackViaPageRequest?: boolean;
}

export type SlugLookupStatus = 'available' | 'taken' | 'pending' | 'blocked' | 'invalid_format';

export interface SlugLookupOwner {
  slug?: string;
  name?: string;
  avatarUrl?: string;
}

export interface SlugLookupResult {
  slug: string;
  status: SlugLookupStatus;
  available: boolean;
  price: number | null;
  owner: SlugLookupOwner | null;
  canOpenOwner: boolean;
  canBuy: boolean;
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

export interface ProfileCardPet {
  id: string;
  petType: ProfileCardPetType;
  label: string;
  assetUrl: string;
  displayName: string;
  priceSnapshot?: number;
  isVisible: boolean;
  createdAt?: string | null;
}

export interface PetCatalogItem {
  id: string;
  petType: ProfileCardPetType;
  label: string;
  description?: string;
  assetUrl: string;
  price: number;
  defaultPrice?: number;
  settingKey?: string;
}

export interface PetRequest {
  id: string;
  type: 'pet';
  petType: ProfileCardPetType;
  petLabel: string;
  displayName: string;
  priceSnapshot: number;
  totalOneTime?: number;
  status: 'pending' | 'approved' | 'rejected' | string;
  statusBadge?: string;
  adminNote?: string | null;
  paymentReference?: string;
  paymentUrl?: string;
  createdAt?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  purchasedAt?: string | null;
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
  verified?: boolean;
  verifiedCompany?: string;
  theme: ProfileCardTheme;
  avatarFrame?: ProfileCardAvatarFrame;
  emojiBackgroundPack?: ProfileCardEmojiBackgroundPack;
  pets?: ProfileCardPet[];
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

export interface PublicLiveStats {
  activeCardsTotal: number;
  todayCreated: number;
  todayActivated: number;
  todayTotal: number;
  todayVisitors: number;
}

export interface PublicSlugCounter {
  taken: number;
  total: number;
}

export interface PublicHeroSearch {
  title: string;
  subtitle: string;
  placeholder: string;
  checkLabel: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  occupancyLabel?: string;
  initialSlug?: string;
}

export interface FeaturedProfile {
  slug: string;
  href: string;
  name: string;
  avatarUrl?: string;
  initials?: string;
}

export interface LatestHomePost {
  id: string;
  slug: string;
  href: string;
  commentsHref?: string;
  shareHref?: string;
  authorName: string;
  authorSlug: string;
  authorAvatarUrl?: string;
  authorInitials?: string;
  authorVerified?: boolean;
  content: string;
  publishedAtLabel: string;
  likesCount: number;
  commentsCount: number;
  viewerHasLiked: boolean;
  viewerIsFollowing: boolean;
  loginNext?: string;
}

export interface LatestCreatedCard {
  slug: string;
  href: string;
  rank?: string;
  dateLabel?: string;
  name: string;
  avatarUrl?: string;
  initials?: string;
  role?: string;
  kind?: string;
  bio?: string;
}

export interface WeeklyTopCard {
  slug: string;
  href: string;
  name: string;
  avatarUrl?: string;
  initials?: string;
  rankLabel?: string;
  viewsLabel?: string;
  verified?: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface StickerOffer {
  eyebrow: string;
  title: string;
  description: string;
  oldPrice?: string;
  price: string;
  discountBadge?: string;
  availabilityLabel?: string;
  metaLabel?: string;
  points: string[];
  note?: string;
  imageUrl?: string;
  ctaLabel: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface PublicFooter {
  tagline: string;
  links: FooterLink[];
  phoneLabel?: string;
  phoneHref?: string;
  copyright: string;
}

export interface OfficialSlugConfig {
  letters?: string[];
  notices?: Array<{
    pattern: string;
    title?: string;
    body?: string;
    tone?: string;
  }>;
}

export interface PublicHomePayload {
  liveStats: PublicLiveStats | null;
  slugCounter: PublicSlugCounter | null;
  heroSearch: PublicHeroSearch;
  featuredProfiles: FeaturedProfile[];
  latestPosts: LatestHomePost[];
  latestCreated: LatestCreatedCard[];
  weeklyTop: WeeklyTopCard[];
  stickerOffer: StickerOffer | null;
  faq: FaqItem[];
  footer: PublicFooter | null;
  officialConfig: OfficialSlugConfig | null;
}
