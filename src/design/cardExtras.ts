import {
  PetCatalogItem,
  PetRequest,
  ProfileCardAvatarFrame,
  ProfileCardEmojiBackgroundPack,
  ProfileCardPet,
  ProfileCardPetType,
} from '@/types';

export const PROFILE_AVATAR_FRAME_OPTIONS: Array<{
  id: ProfileCardAvatarFrame;
  label: string;
  description: string;
  premium?: boolean;
}> = [
  { id: 'none', label: 'Без рамки', description: 'Чистый круглый аватар' },
  { id: 'chrome_ring', label: 'Chrome Ring', description: 'Металлическое кольцо', premium: true },
  { id: 'neon_spray', label: 'Neon Spray', description: 'Неоновый spray glow', premium: true },
  { id: 'sticker_bubble', label: 'Sticker Bubble', description: 'Виниловый стикер', premium: true },
  { id: 'chain_link', label: 'Chain Link', description: 'Цепной контур', premium: true },
  { id: 'pixel_glow', label: 'Pixel Glow', description: 'Пиксельная аура', premium: true },
  { id: 'starburst', label: 'Starburst', description: 'Звёздный взрыв', premium: true },
  { id: 'drip_outline', label: 'Drip Outline', description: 'Краска с потёками', premium: true },
  { id: 'tape_collage', label: 'Tape Collage', description: 'Коллаж из лент', premium: true },
  { id: 'orbit_dots', label: 'Orbit Dots', description: 'Орбиты и точки', premium: true },
];

export const PROFILE_EMOJI_BACKGROUND_OPTIONS: Array<{
  id: ProfileCardEmojiBackgroundPack;
  label: string;
  description: string;
  premium?: boolean;
}> = [
  { id: 'none', label: 'Без фона', description: 'Только текущая тема' },
  { id: 'ghosts', label: 'Ghosts', description: 'Мягкие силуэты', premium: true },
  { id: 'stars', label: 'Stars', description: 'Звёздная сетка', premium: true },
  { id: 'lightning', label: 'Lightning', description: 'Электрический узор', premium: true },
  { id: 'crowns', label: 'Crowns', description: 'Короны и prestige', premium: true },
  { id: 'webs', label: 'Webs', description: 'Тонкие web-lines', premium: true },
  { id: 'hearts', label: 'Hearts', description: 'Ритм и soft luxe', premium: true },
];

export const PROFILE_PET_LABELS: Record<ProfileCardPetType, string> = {
  kitten: 'Коала',
  puppy: 'Котик',
  snake: 'Леопард',
};

export const PROFILE_PET_ASSETS: Record<ProfileCardPetType, string> = {
  kitten: '/assets/pets/pet1.png',
  puppy: '/assets/pets/pet2.png',
  snake: '/assets/pets/pet3.png',
};

export const PROFILE_PET_PRIORITY: Record<ProfileCardPetType, number> = {
  kitten: 0,
  puppy: 1,
  snake: 2,
};

const PROFILE_AVATAR_FRAME_SET = new Set<ProfileCardAvatarFrame>(
  PROFILE_AVATAR_FRAME_OPTIONS.map((item) => item.id),
);
const PROFILE_EMOJI_BACKGROUND_SET = new Set<ProfileCardEmojiBackgroundPack>(
  PROFILE_EMOJI_BACKGROUND_OPTIONS.map((item) => item.id),
);
const PROFILE_PET_TYPE_SET = new Set<ProfileCardPetType>(['kitten', 'puppy', 'snake']);

export function normalizeProfileAvatarFrame(value: unknown): ProfileCardAvatarFrame {
  const normalized = String(value ?? '').trim().toLowerCase() as ProfileCardAvatarFrame;
  return PROFILE_AVATAR_FRAME_SET.has(normalized) ? normalized : 'none';
}

export function normalizeProfileEmojiBackgroundPack(value: unknown): ProfileCardEmojiBackgroundPack {
  const normalized = String(value ?? '').trim().toLowerCase() as ProfileCardEmojiBackgroundPack;
  return PROFILE_EMOJI_BACKGROUND_SET.has(normalized) ? normalized : 'none';
}

export function normalizeProfilePetType(value: unknown): ProfileCardPetType | null {
  const normalized = String(value ?? '').trim().toLowerCase() as ProfileCardPetType;
  return PROFILE_PET_TYPE_SET.has(normalized) ? normalized : null;
}

export function normalizeProfilePet(input: unknown): ProfileCardPet | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const source = input as Record<string, unknown>;
  const petType = normalizeProfilePetType(source.petType);
  if (!petType) {
    return null;
  }

  const displayName = String(source.displayName ?? '').trim();
  if (!displayName) {
    return null;
  }

  const rawAssetUrl = String(source.assetUrl ?? '').trim();
  const priceSnapshot = Number(source.priceSnapshot);
  return {
    id: String(source.id ?? '').trim(),
    petType,
    label: String(source.label ?? PROFILE_PET_LABELS[petType]).trim() || PROFILE_PET_LABELS[petType],
    assetUrl: rawAssetUrl || PROFILE_PET_ASSETS[petType],
    displayName,
    priceSnapshot: Number.isFinite(priceSnapshot) ? priceSnapshot : undefined,
    isVisible: source.isVisible !== false,
    createdAt: source.createdAt ? String(source.createdAt) : null,
  };
}

export function sortProfilePets(items: unknown): ProfileCardPet[] {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeProfilePet(item))
    .filter((item): item is ProfileCardPet => item !== null)
    .sort((left, right) => {
      const leftPriority = PROFILE_PET_PRIORITY[left.petType] ?? 99;
      const rightPriority = PROFILE_PET_PRIORITY[right.petType] ?? 99;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      const leftTime = Date.parse(String(left.createdAt ?? '')) || 0;
      const rightTime = Date.parse(String(right.createdAt ?? '')) || 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.id.localeCompare(right.id);
    });
}

export function getVisibleProfilePets(items: unknown): ProfileCardPet[] {
  return sortProfilePets(items).filter((item) => item.isVisible).slice(0, 3);
}

export function getPetSlots(count: number): Array<'left' | 'top-right' | 'bottom-right'> {
  if (count >= 3) return ['left', 'top-right', 'bottom-right'];
  if (count === 2) return ['left', 'top-right'];
  if (count === 1) return ['top-right'];
  return [];
}

export function normalizePetCatalogItem(input: unknown): PetCatalogItem | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const source = input as Record<string, unknown>;
  const petType = normalizeProfilePetType(source.petType ?? source.id);
  if (!petType) {
    return null;
  }
  const price = Number(source.price ?? source.defaultPrice);
  return {
    id: String(source.id ?? petType).trim() || petType,
    petType,
    label: String(source.label ?? PROFILE_PET_LABELS[petType]).trim() || PROFILE_PET_LABELS[petType],
    description: source.description ? String(source.description) : undefined,
    assetUrl: String(source.assetUrl ?? PROFILE_PET_ASSETS[petType]).trim() || PROFILE_PET_ASSETS[petType],
    price: Number.isFinite(price) ? price : 0,
    defaultPrice: Number.isFinite(Number(source.defaultPrice)) ? Number(source.defaultPrice) : undefined,
    settingKey: source.settingKey ? String(source.settingKey) : undefined,
  };
}

export function normalizePetRequest(input: unknown): PetRequest | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const source = input as Record<string, unknown>;
  if (String(source.type ?? '').trim().toLowerCase() !== 'pet') {
    return null;
  }
  const petType = normalizeProfilePetType(source.petType);
  if (!petType) {
    return null;
  }
  const priceSnapshot = Number(source.priceSnapshot ?? source.totalOneTime);
  return {
    id: String(source.id ?? '').trim(),
    type: 'pet',
    petType,
    petLabel: String(source.petLabel ?? PROFILE_PET_LABELS[petType]).trim() || PROFILE_PET_LABELS[petType],
    displayName: String(source.displayName ?? '').trim(),
    priceSnapshot: Number.isFinite(priceSnapshot) ? priceSnapshot : 0,
    totalOneTime: Number.isFinite(Number(source.totalOneTime)) ? Number(source.totalOneTime) : undefined,
    status: String(source.status ?? 'pending').trim().toLowerCase(),
    statusBadge: source.statusBadge ? String(source.statusBadge) : undefined,
    adminNote: source.adminNote ? String(source.adminNote) : null,
    paymentReference: source.paymentReference ? String(source.paymentReference) : undefined,
    paymentUrl: source.paymentUrl ? String(source.paymentUrl) : undefined,
    createdAt: source.createdAt ? String(source.createdAt) : null,
    requestedAt: source.requestedAt ? String(source.requestedAt) : null,
    reviewedAt: source.reviewedAt ? String(source.reviewedAt) : null,
    purchasedAt: source.purchasedAt ? String(source.purchasedAt) : null,
  };
}
