import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Plus, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarFrameOverlay, CardEmojiBackground } from '@/components/profile/CardOrnaments';
import { CardThemeBackdrop } from '@/components/profile/CardThemeBackdrop';
import { ProfileCard, ThemeTokens } from '@/types';
import { BUTTON_ICONS, inferButtonIcon, normalizeButtonIconKey } from '@/components/profile/buttonIcons';
import { normalizeButtonUrl } from '@/components/profile/normalizeButtonUrl';
import { CARD_THEME_OPTIONS, resolveProfileCardTheme } from '@/design/cardThemes';
import {
  PROFILE_AVATAR_FRAME_OPTIONS,
  PROFILE_EMOJI_BACKGROUND_OPTIONS,
  PROFILE_PET_LABELS,
  sortProfilePets,
} from '@/design/cardExtras';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { resolveAssetUrl } from '@/lib/assetUrl';
import { runThrottled } from '@/utils/navigation';
import { PetCatalogItem, PetRequest, ProfileCardAvatarFrame, ProfileCardEmojiBackgroundPack, ProfileCardPet } from '@/types';

interface CardEditorProps {
  visible: boolean;
  tokens: ThemeTokens;
  card: ProfileCard;
  saving: boolean;
  userPlan: 'basic' | 'premium' | string;
  petCatalog?: PetCatalogItem[];
  petRequests?: PetRequest[];
  requestingPetType?: string | null;
  onClose: () => void;
  onPreview: (card: ProfileCard) => void;
  onRequestPet?: (payload: { petType: string; displayName: string }) => void;
  onSave: (card: ProfileCard) => void;
}


const MAX_BUTTONS = 6;
const MAX_BIO_LENGTH = 120;
const MAX_PET_NAME_LENGTH = 120;
type EditorSection = 'main' | 'contacts' | 'design' | 'pets' | 'buttons';

function LinearThemePreview({ themeId }: { themeId: ProfileCard['theme'] }): React.JSX.Element {
  const theme = resolveProfileCardTheme(themeId);

  return (
    <View style={[styles.themePreviewInner, { borderRadius: Math.max(12, theme.cardRadius - 6) }]}>
      <LinearGradient colors={theme.cardGradient as [string, string]} style={StyleSheet.absoluteFill} />
      <CardThemeBackdrop theme={theme} rounded={Math.max(12, theme.cardRadius - 6)} />
      {theme.topLineGradient && theme.topLineGradient.length >= 3 ? (
        <LinearGradient colors={theme.topLineGradient as [string, string, string]} style={styles.themePreviewLine} />
      ) : (
        <View style={[styles.themePreviewLine, { backgroundColor: theme.topLineColor }]} />
      )}
      <View style={[styles.themePreviewAvatar, { backgroundColor: theme.avatarBg, borderColor: theme.avatarBorder }]} />
      <View style={styles.themePreviewText}>
        <View style={[styles.themePreviewName, { backgroundColor: theme.nameColor }]} />
        <View style={[styles.themePreviewRole, { backgroundColor: theme.roleColor }]} />
      </View>
    </View>
  );
}

function OrnamentPreview({
  themeId,
  frameId = 'none',
  packId = 'none',
}: {
  themeId: ProfileCard['theme'];
  frameId?: ProfileCardAvatarFrame;
  packId?: ProfileCardEmojiBackgroundPack;
}): React.JSX.Element {
  const theme = resolveProfileCardTheme(themeId);

  return (
    <View style={[styles.themePreviewInner, { borderRadius: Math.max(12, theme.cardRadius - 6) }]}>
      <LinearGradient colors={theme.cardGradient as [string, string]} style={StyleSheet.absoluteFill} />
      <CardThemeBackdrop theme={theme} rounded={Math.max(12, theme.cardRadius - 6)} />
      <CardEmojiBackground pack={packId} theme={theme} />
      {theme.topLineGradient && theme.topLineGradient.length >= 3 ? (
        <LinearGradient colors={theme.topLineGradient as [string, string, string]} style={styles.themePreviewLine} />
      ) : (
        <View style={[styles.themePreviewLine, { backgroundColor: theme.topLineColor }]} />
      )}
      <View style={styles.ornamentPreviewBody}>
        <View style={styles.ornamentPreviewAvatarWrap}>
          <View style={[styles.ornamentPreviewAvatar, { backgroundColor: theme.avatarBg, borderColor: theme.avatarBorder }]} />
          <AvatarFrameOverlay frame={frameId} theme={theme} />
        </View>
        <View style={styles.themePreviewText}>
          <View style={[styles.themePreviewName, { backgroundColor: theme.nameColor }]} />
          <View style={[styles.themePreviewRole, { backgroundColor: theme.roleColor }]} />
        </View>
      </View>
    </View>
  );
}

function resolveButtonValueInputMeta(icon: string, isUz: boolean) {
  const kind = normalizeButtonIconKey(icon);

  if (kind === 'phone' || kind === 'whatsapp') {
    return {
      placeholder: '+998 90 123 45 67',
      keyboardType: 'phone-pad' as const,
      autoCapitalize: 'none' as const,
      autoCorrect: false,
    };
  }

  if (kind === 'email') {
    return {
      placeholder: 'name@example.com',
      keyboardType: 'email-address' as const,
      autoCapitalize: 'none' as const,
      autoCorrect: false,
    };
  }

  if (kind === 'telegram') {
    return {
      placeholder: isUz ? '@username yoki t.me/username' : '@username или t.me/username',
      keyboardType: 'default' as const,
      autoCapitalize: 'none' as const,
      autoCorrect: false,
    };
  }

  if (kind === 'instagram') {
    return {
      placeholder: isUz ? '@username yoki instagram.com/username' : '@username или instagram.com/username',
      keyboardType: 'default' as const,
      autoCapitalize: 'none' as const,
      autoCorrect: false,
    };
  }

  if (kind === 'tiktok') {
    return {
      placeholder: isUz ? '@username yoki tiktok.com/@username' : '@username или tiktok.com/@username',
      keyboardType: 'default' as const,
      autoCapitalize: 'none' as const,
      autoCorrect: false,
    };
  }

  if (kind === 'youtube') {
    return {
      placeholder: isUz ? '@kanal yoki youtube.com/@kanal' : '@канал или youtube.com/@канал',
      keyboardType: 'default' as const,
      autoCapitalize: 'none' as const,
      autoCorrect: false,
    };
  }

  if (kind === 'card') {
    return {
      placeholder: '8600 1234 5678 9012',
      keyboardType: 'number-pad' as const,
      autoCapitalize: 'none' as const,
      autoCorrect: false,
    };
  }

  if (kind === 'website') {
    return {
      placeholder: 'https://example.com',
      keyboardType: 'url' as const,
      autoCapitalize: 'none' as const,
      autoCorrect: false,
    };
  }

  return {
    placeholder: isUz ? 'Havola yoki qiymat' : 'Ссылка или значение',
    keyboardType: 'default' as const,
    autoCapitalize: 'sentences' as const,
    autoCorrect: false,
  };
}

export function CardEditor({
  visible,
  tokens,
  card,
  saving,
  userPlan,
  petCatalog = [],
  petRequests = [],
  requestingPetType = null,
  onClose,
  onPreview,
  onRequestPet,
  onSave,
}: CardEditorProps): React.JSX.Element {
  const { language } = useLanguageContext();
  const insets = useSafeAreaInsets();
  const isUz = language === 'uz';
  const text = isUz
    ? {
      back: '← Orqaga',
      title: 'Tahrirlash',
      preview: "Ko'rish",
      sectionMain: "Asosiy",
      sectionContacts: 'Kontaktlar',
      sectionDesign: 'Dizayn',
      sectionPets: 'Pets',
      sectionButtons: "Tugmalar",
      upload: 'Yuklash',
      remove: "O'chirish",
      avatarHint: 'Profil rasmini yuklang yoki o‘chiring',
      mainInfo: "Asosiy ma'lumot",
      name: 'Ism',
      about: 'Bio',
      aboutPlaceholder: "O'zingiz haqingizda (120 belgigacha)",
      phone: 'Telefon',
      telegram: 'Telegram',
      email: 'Email',
      hashtag: 'Pastki hashtag',
      tags: 'Teglar',
      tagsPlaceholder: '#Dizayner',
      add: "Qo'shish",
      address: 'Manzil',
      postcode: 'Indeks',
      extraPhone: "Qo'shimcha telefon",
      hideBranding: 'UNQX brendingini yashirish',
      cardTheme: 'Vizitka mavzusi',
      emojiBackground: 'Emoji background',
      avatarFrame: 'Avatar frame',
      pets: 'Pets',
      petsOwned: 'Mening petslarim',
      petsCatalog: 'Yangi pet qo‘shish',
      petName: 'Pet ismi',
      petNamePlaceholder: 'Ism bering',
      petVisible: 'Kartada ko‘rsatish',
      petBuy: 'Sotib olish',
      petPending: 'To‘lovni ochish',
      petApproved: 'Tasdiqlangan',
      petRejected: 'Qayta yuborish',
      petEmpty: 'Hali pets yo‘q. Premium orqali xarid qiling.',
      petLockedHint: 'Ramkalar, fonlar va pets Premium tarifida ochiladi',
      premiumThemesHint: 'Premium mavzular faqat Premium tarifda mavjud',
      buttons: "Tugmalar",
      buttonTitle: 'Nomi',
      buttonValue: 'Qiymat',
      save: "O'zgarishlarni saqlash",
      requiredName: 'Ism majburiy (kamida 2 belgi)',
      maxBio: 'Maksimum 120 belgi',
      invalidEmail: "Noto'g'ri email",
      invalidButtons: "Nomi bor tugmalarda qiymat bo'lishi kerak",
    }
    : {
      back: '← Назад',
      title: 'Редактор',
      preview: 'Превью',
      sectionMain: 'Основное',
      sectionContacts: 'Контакты',
      sectionDesign: 'Оформление',
      sectionPets: 'Питомцы',
      sectionButtons: 'Кнопки',
      upload: 'Загрузить',
      remove: 'Удалить',
      avatarHint: 'Загрузите или удалите фото профиля',
      mainInfo: 'Основная информация',
      name: 'Имя',
      about: 'Bio',
      aboutPlaceholder: 'О себе (до 120 символов)',
      phone: 'Телефон',
      telegram: 'Telegram',
      email: 'Email',
      hashtag: 'Нижний хэштег',
      tags: 'Теги',
      tagsPlaceholder: '#Дизайнер',
      add: 'Добавить',
      address: 'Адрес',
      postcode: 'Индекс',
      extraPhone: 'Доп. телефон',
      hideBranding: 'Скрыть брендинг UNQX',
      cardTheme: 'Тема визитки',
      emojiBackground: 'Emoji Background',
      avatarFrame: 'Avatar Frame',
      pets: 'Питомцы',
      petsOwned: 'Мои питомцы',
      petsCatalog: 'Добавить питомца',
      petName: 'Имя питомца',
      petNamePlaceholder: 'Дайте имя',
      petVisible: 'Показывать на карточке',
      petBuy: 'Купить',
      petPending: 'Открыть оплату',
      petApproved: 'Подтверждено',
      petRejected: 'Отправить снова',
      petEmpty: 'Питомцев пока нет. Их можно купить на Premium.',
      petLockedHint: 'Рамки, фоны и питомцы доступны на Premium',
      premiumThemesHint: 'Премиум-темы доступны только на тарифе Premium',
      buttons: 'Кнопки',
      buttonTitle: 'Название',
      buttonValue: 'Значение',
      save: 'Сохранить изменения',
      requiredName: 'Имя обязательно (минимум 2 символа)',
      maxBio: 'Максимум 120 символов',
      invalidEmail: 'Некорректный email',
      invalidButtons: 'У всех кнопок с названием должно быть значение',
    };
  // Валидация
  const [errors, setErrors] = React.useState<any>({});
  const isPremiumPlan = String(userPlan).toLowerCase() === 'premium';
  // Расширяем локальное состояние для новых полей
  const [local, setLocal] = React.useState<any>({
    ...card,
    bio: card.bio || '',
    hashtag: card.hashtag || '',
    tags: card.tags || [],
    address: card.address || '',
    postcode: card.postcode || '',
    extraPhone: card.extraPhone || '',
    showBranding: card.showBranding !== undefined ? card.showBranding : true,
    avatarFrame: card.avatarFrame || 'none',
    emojiBackgroundPack: card.emojiBackgroundPack || 'none',
    pets: sortProfilePets(card.pets || []),
  });
  const [petDraftNames, setPetDraftNames] = React.useState<Record<string, string>>({});
  const [tagInput, setTagInput] = React.useState('');
  const [activeSection, setActiveSection] = React.useState<EditorSection>('main');
  const avatarImage = useRetryImageUri(local.avatarUrl);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const isDirty = React.useMemo(() => JSON.stringify(local) !== JSON.stringify(card), [card, local]);
  const petRequestMap = React.useMemo(() => {
    const sorted = [...petRequests].sort((left, right) => {
      const leftTime = Date.parse(String(left.createdAt ?? left.requestedAt ?? '')) || 0;
      const rightTime = Date.parse(String(right.createdAt ?? right.requestedAt ?? '')) || 0;
      return rightTime - leftTime;
    });
    const map = new Map<string, PetRequest>();
    for (const item of sorted) {
      map.set(item.petType, item);
    }
    return map;
  }, [petRequests]);
  const ownedPetTypes = React.useMemo(
    () => new Set((Array.isArray(local.pets) ? local.pets : []).map((pet: ProfileCardPet) => pet.petType)),
    [local.pets],
  );
  const catalogPets = React.useMemo(
    () => petCatalog.filter((item) => !ownedPetTypes.has(item.petType)),
    [ownedPetTypes, petCatalog],
  );

  // Проверка полей
  React.useEffect(() => {
    const nextErrors: any = {};
    if (!local.name || local.name.trim().length < 2) {
      nextErrors.name = text.requiredName;
    }
    if (local.bio && local.bio.length > MAX_BIO_LENGTH) {
      nextErrors.bio = text.maxBio;
    }
    if (local.email && !/^\S+@\S+\.\S+$/.test(local.email)) {
      nextErrors.email = text.invalidEmail;
    }
    if (local.buttons && local.buttons.some((b: any) => b.label && !b.url)) {
      nextErrors.buttons = text.invalidButtons;
    }
    setErrors(nextErrors);
  }, [local, text.invalidButtons, text.invalidEmail, text.maxBio, text.requiredName]);

  React.useEffect(() => {
    if (visible) {
      setLocal({
        ...card,
        bio: card.bio || '',
        hashtag: card.hashtag || '',
        tags: card.tags || [],
        address: card.address || '',
        postcode: card.postcode || '',
        extraPhone: card.extraPhone || '',
        showBranding: card.showBranding !== undefined ? card.showBranding : true,
        avatarFrame: card.avatarFrame || 'none',
        emojiBackgroundPack: card.emojiBackgroundPack || 'none',
        pets: sortProfilePets(card.pets || []),
        buttons: Array.isArray(card.buttons) ? card.buttons : [],
      });
      setPetDraftNames(
        petCatalog.reduce<Record<string, string>>((acc, item) => {
          const matchingRequest = petRequestMap.get(item.petType);
          acc[item.petType] = matchingRequest?.displayName || PROFILE_PET_LABELS[item.petType];
          return acc;
        }, {}),
      );
      setTagInput('');
      setActiveSection('main');
    }
  }, [card, petCatalog, petRequestMap, visible]);

  const editorSections = React.useMemo<Array<{ key: EditorSection; label: string }>>(() => ([
    { key: 'main', label: text.sectionMain },
    { key: 'contacts', label: text.sectionContacts },
    { key: 'design', label: text.sectionDesign },
    { key: 'pets', label: text.sectionPets },
    { key: 'buttons', label: text.sectionButtons },
  ]), [text.sectionButtons, text.sectionContacts, text.sectionDesign, text.sectionMain, text.sectionPets]);

  const updateField = (key: string, value: any) => {
    setLocal((prev: any) => ({ ...prev, [key]: value }));
  };

  const updatePet = (petType: ProfileCardPet['petType'], patch: Partial<ProfileCardPet>) => {
    setLocal((prev: any) => ({
      ...prev,
      pets: sortProfilePets(
        (Array.isArray(prev.pets) ? prev.pets : []).map((pet: ProfileCardPet) => (
          pet.petType === petType
            ? {
              ...pet,
              ...patch,
            }
            : pet
        )),
      ),
    }));
  };

  const updatePetDraftName = (petType: string, value: string) => {
    setPetDraftNames((prev) => ({
      ...prev,
      [petType]: value.slice(0, MAX_PET_NAME_LENGTH),
    }));
  };

  const formatPetPrice = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return isUz ? "Narx aniqlanmoqda" : 'Цена уточняется';
    }
    return `${new Intl.NumberFormat(isUz ? 'uz-UZ' : 'ru-RU').format(value)} so'm`;
  };

  const handleRequestPetPress = (petType: string) => {
    if (!onRequestPet) {
      return;
    }
    const displayName = String(petDraftNames[petType] ?? PROFILE_PET_LABELS[petType as keyof typeof PROFILE_PET_LABELS] ?? '').trim();
    onRequestPet({
      petType,
      displayName,
    });
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !local.tags.includes(tag)) {
      setLocal((prev: any) => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const removeTag = (idx: number) => {
    setLocal((prev: any) => ({ ...prev, tags: prev.tags.filter((_: string, i: number) => i !== idx) }));
  };

  const updateButton = (index: number, patch: Partial<ProfileCard['buttons'][number]>) => {
    setLocal((prev: any) => ({
      ...prev,
      buttons: prev.buttons.map((button: any, i: number) => {
        if (i !== index) {
          return button;
        }
        const next = { ...button, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, 'icon')) {
          return { ...next, icon: normalizeButtonIconKey(String(next.icon || 'other')) };
        }
        return {
          ...next,
          icon: inferButtonIcon({
            label: next.label,
            url: next.url,
            currentIcon: next.icon,
          }),
        };
      }),
    }));
  };

  const addButton = () => {
    if (local.buttons.length < MAX_BUTTONS) {
      setLocal((prev: any) => ({
        ...prev,
        buttons: [
          ...prev.buttons,
          { label: '', url: '', icon: 'other' }
        ]
      }));
    }
  };

  const removeButton = (index: number) => {
    setLocal((prev: any) => ({
      ...prev,
      buttons: prev.buttons.filter((_: any, i: number) => i !== index)
    }));
  };

  const pickAvatar = async () => {
    setAvatarUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        updateField('avatarUrl', result.assets[0].uri);
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = () => {
    updateField('avatarUrl', '');
  };

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.root, { backgroundColor: tokens.phoneBg }]}
      >
        <View
          style={[
            styles.header,
            {
              borderBottomColor: tokens.border,
              paddingTop: Math.max(10, insets.top + 4),
            },
          ]}
        >
          <View style={styles.headerSide}>
            <Pressable onPress={() => runThrottled(onClose)} hitSlop={8}>
              <Text style={[styles.headerAction, { color: tokens.textMuted }]}>{text.back}</Text>
            </Pressable>
          </View>
          <Text style={[styles.headerTitle, { color: tokens.text }]} numberOfLines={1}>{text.title}</Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <Pressable onPress={() => runThrottled(() => onPreview(local))} hitSlop={8}>
              <Text style={[styles.headerAction, { color: tokens.accent }]}>{text.preview}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(32, insets.bottom + 72) }]}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.avatarBlock}>
            <View style={[styles.avatar, { backgroundColor: `${tokens.accent}14` }]}>
              {avatarUploading ? (
                <ActivityIndicator color={tokens.accent} />
              ) : avatarImage.showImage && avatarImage.imageUri ? (
                <Image
                  key={`${local.avatarUrl}:${avatarImage.retryCount}`}
                  source={{ uri: avatarImage.imageUri }}
                  style={styles.avatarImage}
                  onError={avatarImage.onError}
                />
              ) : (
                <Text style={[styles.avatarText, { color: tokens.accent }]}>{local.name[0] || 'A'}</Text>
              )}
              <Pressable style={[styles.avatarPlus, { backgroundColor: tokens.accent }]} onPress={pickAvatar}>
                <Camera size={12} strokeWidth={1.5} color={tokens.accentText} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <Pressable onPress={pickAvatar} style={[styles.addBtn, { backgroundColor: tokens.inputBg }]}>
                <Text style={{ color: tokens.accent }}>{text.upload}</Text>
              </Pressable>
              {!!local.avatarUrl && (
                <Pressable onPress={removeAvatar} style={[styles.addBtn, { backgroundColor: tokens.inputBg }]}>
                  <Text style={{ color: tokens.red }}>{text.remove}</Text>
                </Pressable>
              )}
            </View>
            <Text style={[styles.avatarHint, { color: tokens.textMuted }]}>{text.avatarHint}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsContent}
            style={styles.categoryTabs}
          >
            {editorSections.map((section) => {
              const active = activeSection === section.key;
              return (
                <Pressable
                  key={section.key}
                  onPress={() => setActiveSection(section.key)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? tokens.accent : tokens.surfaceElevated,
                      borderColor: active ? tokens.accent : tokens.border,
                    },
                  ]}
                >
                  <Text style={[styles.categoryChipText, { color: active ? tokens.accentText : tokens.text }]}>
                    {section.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeSection === 'main' ? (
            <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
              <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{text.mainInfo}</Text>
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{`${text.name} *`}</Text>
                <TextInput
                  value={local.name}
                  onChangeText={(v) => updateField('name', v)}
                  placeholder={text.name}
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                  maxLength={40}
                />
                {errors.name && <Text style={{ color: tokens.red, fontSize: 11 }}>{errors.name}</Text>}
              </View>
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.about}</Text>
                <TextInput
                  value={local.bio}
                  onChangeText={(v) => updateField('bio', v.slice(0, MAX_BIO_LENGTH))}
                  placeholder={text.aboutPlaceholder}
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, minHeight: 60 }]}
                  multiline
                  maxLength={MAX_BIO_LENGTH}
                />
                <Text style={{ fontSize: 11, color: tokens.textMuted, alignSelf: 'flex-end' }}>{local.bio.length}/{MAX_BIO_LENGTH}</Text>
                {errors.bio && <Text style={{ color: tokens.red, fontSize: 11 }}>{errors.bio}</Text>}
              </View>
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.hashtag}</Text>
                <TextInput
                  value={local.hashtag}
                  onChangeText={(v) => updateField('hashtag', v)}
                  placeholder='#UnqPower2026'
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.tags}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={tagInput}
                    onChangeText={setTagInput}
                    placeholder={text.tagsPlaceholder}
                    placeholderTextColor={tokens.textMuted}
                    style={[styles.fieldInput, { flex: 1, backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                    onSubmitEditing={addTag}
                  />
                  <Pressable onPress={addTag} style={[styles.addBtn, { alignSelf: 'center' }]}>
                    <Text style={[styles.addText, { color: tokens.accent }]}>{text.add}</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {local.tags.map((tag: string, idx: number) => (
                    <View key={tag + idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.inputBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: tokens.text, fontSize: 12 }}>{tag}</Text>
                      <Pressable onPress={() => removeTag(idx)}>
                        <Text style={{ color: tokens.red, marginLeft: 4 }}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {activeSection === 'contacts' ? (
            <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
              <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{text.sectionContacts}</Text>
              {[
                [text.phone, 'phone'],
                [text.telegram, 'telegram'],
                [text.email, 'email'],
              ].map(([label, key]) => (
                <View key={key} style={styles.fieldBlock}>
                  <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{label}</Text>
                  <TextInput
                    value={String(local[key] ?? '')}
                    onChangeText={(v) => updateField(key, v)}
                    placeholder={String(label)}
                    placeholderTextColor={tokens.textMuted}
                    style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                  />
                  {key === 'email' && errors.email && <Text style={{ color: tokens.red, fontSize: 11 }}>{errors.email}</Text>}
                </View>
              ))}
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.address}</Text>
                <TextInput
                  value={local.address}
                  onChangeText={(v) => updateField('address', v)}
                  placeholder='Farghona, Mustaqillik 13'
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.postcode}</Text>
                <TextInput
                  value={local.postcode}
                  onChangeText={(v) => updateField('postcode', v)}
                  placeholder='150100'
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.extraPhone}</Text>
                <TextInput
                  value={local.extraPhone}
                  onChangeText={(v) => updateField('extraPhone', v)}
                  placeholder='+998200001360'
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                />
              </View>
            </View>
          ) : null}

          {activeSection === 'design' ? (
            <>
              <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Switch
                    value={local.showBranding}
                    onValueChange={(v) => updateField('showBranding', v)}
                    trackColor={{ false: tokens.border, true: tokens.accent }}
                    thumbColor={local.showBranding ? tokens.accent : tokens.inputBg}
                  />
                  <Text style={{ color: tokens.text, marginLeft: 8 }}>{text.hideBranding}</Text>
                </View>
              </View>

              <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
                <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{text.cardTheme}</Text>
                <View style={styles.themeGrid}>
                  {CARD_THEME_OPTIONS.map((option) => {
                    const locked = option.premium && !isPremiumPlan;
                    const themeSpec = resolveProfileCardTheme(option.id);
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => !locked && updateField('theme', option.id)}
                        style={[
                          styles.themeBtn,
                          {
                            borderColor: local.theme === option.id ? tokens.borderStrong : tokens.border,
                            backgroundColor: local.theme === option.id ? tokens.surface : tokens.inputBg,
                            opacity: locked ? 0.5 : 1,
                          },
                        ]}
                        disabled={locked}
                      >
                        <View style={styles.themePreview}>
                          <LinearThemePreview themeId={option.id} />
                          {locked ? <View style={[styles.themeLock, { backgroundColor: 'rgba(0,0,0,0.28)' }]}><Text style={styles.themeLockText}>🔒</Text></View> : null}
                        </View>
                        <View style={styles.themeMeta}>
                          <Text style={[styles.themeText, { color: local.theme === option.id ? tokens.text : tokens.textMuted }]} numberOfLines={1}>
                            {option.label}
                          </Text>
                          <Text style={[styles.themeSubtext, { color: themeSpec.roleColor }]} numberOfLines={1}>
                            {themeSpec.premium ? 'Premium theme' : 'Core theme'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {!isPremiumPlan ? (
                  <Text style={{ color: tokens.textMuted, fontSize: 12, marginTop: 6 }}>{text.premiumThemesHint}</Text>
                ) : null}
              </View>

              <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
                <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{text.emojiBackground}</Text>
                <View style={styles.themeGrid}>
                  {PROFILE_EMOJI_BACKGROUND_OPTIONS.map((option) => {
                    const locked = option.premium && !isPremiumPlan;
                    const active = local.emojiBackgroundPack === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => !locked && updateField('emojiBackgroundPack', option.id)}
                        style={[
                          styles.themeBtn,
                          {
                            borderColor: active ? tokens.borderStrong : tokens.border,
                            backgroundColor: active ? tokens.surface : tokens.inputBg,
                            opacity: locked ? 0.5 : 1,
                          },
                        ]}
                        disabled={locked}
                      >
                        <View style={styles.themePreview}>
                          <OrnamentPreview
                            themeId={local.theme}
                            frameId={local.avatarFrame}
                            packId={option.id}
                          />
                          {locked ? <View style={[styles.themeLock, { backgroundColor: 'rgba(0,0,0,0.28)' }]}><Text style={styles.themeLockText}>🔒</Text></View> : null}
                        </View>
                        <View style={styles.themeMeta}>
                          <Text style={[styles.themeText, { color: active ? tokens.text : tokens.textMuted }]} numberOfLines={1}>
                            {option.label}
                          </Text>
                          <Text style={[styles.themeSubtext, { color: tokens.textMuted }]} numberOfLines={2}>
                            {option.description}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {!isPremiumPlan ? (
                  <Text style={{ color: tokens.textMuted, fontSize: 12, marginTop: 6 }}>{text.petLockedHint}</Text>
                ) : null}
              </View>

              <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
                <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{text.avatarFrame}</Text>
                <View style={styles.themeGrid}>
                  {PROFILE_AVATAR_FRAME_OPTIONS.map((option) => {
                    const locked = option.premium && !isPremiumPlan;
                    const active = local.avatarFrame === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => !locked && updateField('avatarFrame', option.id)}
                        style={[
                          styles.themeBtn,
                          {
                            borderColor: active ? tokens.borderStrong : tokens.border,
                            backgroundColor: active ? tokens.surface : tokens.inputBg,
                            opacity: locked ? 0.5 : 1,
                          },
                        ]}
                        disabled={locked}
                      >
                        <View style={styles.themePreview}>
                          <OrnamentPreview
                            themeId={local.theme}
                            frameId={option.id}
                            packId={local.emojiBackgroundPack}
                          />
                          {locked ? <View style={[styles.themeLock, { backgroundColor: 'rgba(0,0,0,0.28)' }]}><Text style={styles.themeLockText}>🔒</Text></View> : null}
                        </View>
                        <View style={styles.themeMeta}>
                          <Text style={[styles.themeText, { color: active ? tokens.text : tokens.textMuted }]} numberOfLines={1}>
                            {option.label}
                          </Text>
                          <Text style={[styles.themeSubtext, { color: tokens.textMuted }]} numberOfLines={2}>
                            {option.description}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {!isPremiumPlan ? (
                  <Text style={{ color: tokens.textMuted, fontSize: 12, marginTop: 6 }}>{text.petLockedHint}</Text>
                ) : null}
              </View>
            </>
          ) : null}

          {activeSection === 'pets' ? (
            <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
              <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{text.pets}</Text>
              <View style={styles.petsSection}>
                <Text style={[styles.sectionSubLabel, { color: tokens.textMuted }]}>{text.petsOwned}</Text>
                {Array.isArray(local.pets) && local.pets.length > 0 ? sortProfilePets(local.pets).map((pet: ProfileCardPet) => {
                  const imageUrl = resolveAssetUrl(pet.assetUrl);
                  return (
                    <View key={pet.id || pet.petType} style={[styles.petCard, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
                      <View style={styles.petCardHead}>
                        <View style={styles.petIdentity}>
                          <View style={[styles.petThumb, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                            {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.petThumbImage} resizeMode='contain' /> : null}
                          </View>
                          <View style={styles.petIdentityMeta}>
                            <Text style={[styles.petTitle, { color: tokens.text }]}>{pet.label}</Text>
                            <Text style={[styles.petSubtitle, { color: tokens.textMuted }]}>{pet.petType}</Text>
                          </View>
                        </View>
                        <View style={styles.petSwitchRow}>
                          <Text style={[styles.petSwitchLabel, { color: tokens.textMuted }]}>{text.petVisible}</Text>
                          <Switch
                            value={pet.isVisible !== false}
                            onValueChange={(value) => updatePet(pet.petType, { isVisible: value })}
                            trackColor={{ false: tokens.border, true: tokens.accent }}
                            thumbColor={pet.isVisible !== false ? tokens.accent : tokens.inputBg}
                          />
                        </View>
                      </View>
                      <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.petName}</Text>
                      <TextInput
                        value={String(pet.displayName ?? '')}
                        onChangeText={(value) => updatePet(pet.petType, { displayName: value.slice(0, MAX_PET_NAME_LENGTH) })}
                        placeholder={text.petNamePlaceholder}
                        placeholderTextColor={tokens.textMuted}
                        style={[styles.fieldInput, { backgroundColor: tokens.surface, borderColor: tokens.border, color: tokens.text }]}
                        maxLength={MAX_PET_NAME_LENGTH}
                      />
                    </View>
                  );
                }) : (
                  <Text style={[styles.emptyText, { color: tokens.textMuted }]}>{text.petEmpty}</Text>
                )}
              </View>

              {catalogPets.length > 0 ? (
                <View style={styles.petsSection}>
                  <Text style={[styles.sectionSubLabel, { color: tokens.textMuted }]}>{text.petsCatalog}</Text>
                  {catalogPets.map((item) => {
                    const request = petRequestMap.get(item.petType);
                    const requestStatus = String(request?.status ?? '').trim().toLowerCase();
                    const isRequesting = requestingPetType === item.petType;
                    const actionLabel = requestStatus === 'approved'
                      ? text.petApproved
                      : requestStatus === 'pending'
                        ? text.petPending
                        : requestStatus === 'rejected'
                          ? text.petRejected
                          : text.petBuy;
                    const actionDisabled = requestStatus === 'approved' || !onRequestPet;
                    const imageUrl = resolveAssetUrl(item.assetUrl);

                    return (
                      <View key={item.id || item.petType} style={[styles.petCard, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
                        <View style={styles.petCardHead}>
                          <View style={styles.petIdentity}>
                            <View style={[styles.petThumb, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                              {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.petThumbImage} resizeMode='contain' /> : null}
                            </View>
                            <View style={styles.petIdentityMeta}>
                              <Text style={[styles.petTitle, { color: tokens.text }]}>{item.label}</Text>
                              <Text style={[styles.petSubtitle, { color: tokens.textMuted }]}>
                                {request?.statusBadge ? request.statusBadge : formatPetPrice(Number(request?.priceSnapshot ?? item.price))}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.petPrice, { color: tokens.accent }]}>{formatPetPrice(Number(item.price))}</Text>
                        </View>

                        <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.petName}</Text>
                        <TextInput
                          value={String(petDraftNames[item.petType] ?? '')}
                          onChangeText={(value) => updatePetDraftName(item.petType, value)}
                          placeholder={text.petNamePlaceholder}
                          placeholderTextColor={tokens.textMuted}
                          style={[styles.fieldInput, { backgroundColor: tokens.surface, borderColor: tokens.border, color: tokens.text }]}
                          maxLength={MAX_PET_NAME_LENGTH}
                        />

                        <Pressable
                          disabled={actionDisabled || isRequesting}
                          onPress={() => handleRequestPetPress(item.petType)}
                          style={[
                            styles.petActionButton,
                            {
                              backgroundColor: actionDisabled ? tokens.surface : tokens.accent,
                              borderColor: actionDisabled ? tokens.border : tokens.accent,
                              opacity: isRequesting ? 0.7 : 1,
                            },
                          ]}
                        >
                          {isRequesting ? (
                            <ActivityIndicator color={actionDisabled ? tokens.textMuted : tokens.accentText} />
                          ) : (
                            <Text style={[styles.petActionText, { color: actionDisabled ? tokens.textMuted : tokens.accentText }]}>
                              {actionLabel}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}

          {activeSection === 'buttons' ? (
            <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
              <View style={styles.buttonsHead}>
                <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{`${text.buttons} (${local.buttons.filter((b: ProfileCard['buttons'][number]) => b.label).length}/6)`}</Text>
                {local.buttons.length < 6 ? (
                  <Pressable onPress={addButton} style={styles.addBtn}>
                    <Plus size={14} strokeWidth={1.5} color={tokens.accent} />
                    <Text style={[styles.addText, { color: tokens.accent }]}>{text.add}</Text>
                  </Pressable>
                ) : null}
              </View>
              {errors.buttons && <Text style={{ color: tokens.red, fontSize: 11, marginBottom: 4 }}>{errors.buttons}</Text>}

              {local.buttons.map((button: ProfileCard['buttons'][number], index: number) => (
                <View key={`btn-${index}`} style={styles.buttonRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
                    {BUTTON_ICONS.map((option) => {
                      const Icon = option.Icon;
                      const active = option.key === button.icon;
                      return (
                        <Pressable
                          key={`${option.key}-${index}`}
                          onPress={() => updateButton(index, { icon: option.key })}
                          style={[
                            styles.iconOption,
                            {
                              borderColor: active ? tokens.borderStrong : tokens.border,
                              backgroundColor: active ? tokens.surface : tokens.inputBg,
                            },
                          ]}
                        >
                          <Icon size={14} strokeWidth={1.5} color={tokens.text} />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {(() => {
                    const valueInputMeta = resolveButtonValueInputMeta(button.icon, isUz);

                    return (
                      <>
                        <TextInput
                          value={button.label}
                          onChangeText={(v) => updateButton(index, { label: v })}
                          placeholder={text.buttonTitle}
                          placeholderTextColor={tokens.textMuted}
                          style={[styles.inlineInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                        />
                        <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{text.buttonValue}</Text>
                        <View style={styles.bottomRow}>
                          <TextInput
                            value={button.url}
                            onChangeText={(v) => updateButton(index, { url: v })}
                            placeholder={valueInputMeta.placeholder}
                            placeholderTextColor={tokens.textMuted}
                            keyboardType={valueInputMeta.keyboardType}
                            autoCapitalize={valueInputMeta.autoCapitalize}
                            autoCorrect={valueInputMeta.autoCorrect}
                            style={[styles.urlInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                          />
                          <Pressable onPress={() => removeButton(index)} style={styles.removeBtn}>
                            <Trash2 size={15} strokeWidth={1.5} color={tokens.red} />
                          </Pressable>
                        </View>
                      </>
                    );
                  })()}
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            disabled={saving || !isDirty || Object.keys(errors).length > 0}
            onPress={() => {
              const fixedButtons = Array.isArray(local.buttons)
                ? local.buttons
                  .map((button: any) => {
                    const label = String(button?.label ?? '').trim();
                    const rawType = String(button?.icon ?? button?.type ?? 'other');
                    const rawUrl = String(button?.url ?? button?.value ?? button?.href ?? '').trim();
                    const normalizedUrl = normalizeButtonUrl(rawType, rawUrl, label);
                    if (!label || !normalizedUrl) {
                      return null;
                    }
                    return {
                      icon: rawType,
                      type: rawType,
                      label,
                      url: normalizedUrl,
                      value: normalizedUrl,
                      href: normalizedUrl,
                    };
                  })
                  .filter((button: any) => Boolean(button))
                : [];

              const payload = {
                ...local,
                pets: sortProfilePets(local.pets).map((pet: ProfileCardPet) => ({
                  ...pet,
                  displayName: String(pet.displayName ?? '').trim() || PROFILE_PET_LABELS[pet.petType],
                })),
                buttons: fixedButtons,
              };
              onSave(payload);
            }}
            style={[styles.saveBtn, { backgroundColor: tokens.accent, opacity: saving || !isDirty || Object.keys(errors).length > 0 ? 0.5 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator color={tokens.accentText} />
            ) : (
              <Text style={[styles.saveText, { color: tokens.accentText }]}>{text.save}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    minHeight: 78,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSide: {
    width: 88,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  headerAction: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 18,
  },
  categoryTabs: {
    marginHorizontal: -4,
  },
  categoryTabsContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  categoryChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  avatarBlock: {
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarPlus: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  block: {
    gap: 10,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  blockLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
  },
  fieldBlock: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  fieldInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 13,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  themeGrid: {
    gap: 10,
  },
  themeBtn: {
    width: '100%',
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  themePreview: {
    width: 76,
    height: 66,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  themePreviewInner: {
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  themePreviewLine: {
    height: 2,
    borderRadius: 999,
    width: '56%',
    marginBottom: 8,
  },
  themePreviewAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  themePreviewText: {
    marginTop: 8,
    gap: 4,
  },
  ornamentPreviewBody: {
    marginTop: 2,
  },
  ornamentPreviewAvatarWrap: {
    width: 32,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ornamentPreviewAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  themePreviewName: {
    width: '72%',
    height: 5,
    borderRadius: 999,
    opacity: 0.9,
  },
  themePreviewRole: {
    width: '48%',
    height: 4,
    borderRadius: 999,
    opacity: 0.55,
  },
  themeMeta: {
    flex: 1,
  },
  themeText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  themeSubtext: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  themeLock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeLockText: {
    fontSize: 14,
  },
  petsSection: {
    gap: 10,
  },
  sectionSubLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
  },
  petCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  petCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  petIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  petIdentityMeta: {
    flex: 1,
    gap: 2,
  },
  petThumb: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  petThumbImage: {
    width: '82%',
    height: '82%',
  },
  petTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  petSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Inter_400Regular',
  },
  petPrice: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  petSwitchRow: {
    alignItems: 'flex-end',
    gap: 6,
  },
  petSwitchLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_500Medium',
  },
  petActionButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  petActionText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  buttonsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  buttonRow: {
    gap: 8,
  },
  iconRow: {
    gap: 6,
  },
  iconOption: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineInput: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  urlInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
