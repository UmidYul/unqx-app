import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Switch, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Plus, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardThemeBackdrop } from '@/components/profile/CardThemeBackdrop';
import { ProfileCard, ThemeTokens } from '@/types';
import { BUTTON_ICONS, inferButtonIcon, normalizeButtonIconKey } from '@/components/profile/buttonIcons';
import { normalizeButtonUrl } from '@/components/profile/normalizeButtonUrl';
import { CARD_THEME_OPTIONS, resolveProfileCardTheme } from '@/design/cardThemes';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { runThrottled } from '@/utils/navigation';

interface CardEditorProps {
  visible: boolean;
  tokens: ThemeTokens;
  card: ProfileCard;
  saving: boolean;
  userPlan: 'basic' | 'premium' | string;
  onClose: () => void;
  onPreview: (card: ProfileCard) => void;
  onSave: (card: ProfileCard) => void;
}


const MAX_BUTTONS = 6;
const MAX_BIO_LENGTH = 120;

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

export function CardEditor({ visible, tokens, card, saving, userPlan, onClose, onPreview, onSave }: CardEditorProps): React.JSX.Element {
  const { language } = useLanguageContext();
  const insets = useSafeAreaInsets();
  const isUz = language === 'uz';
  const text = isUz
    ? {
      back: '← Orqaga',
      title: 'Tahrirlash',
      preview: "Ko'rish",
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
      premiumThemesHint: 'Premium mavzular faqat Premium tarifda mavjud',
      buttons: "Tugmalar",
      buttonTitle: 'Nomi',
      save: "O'zgarishlarni saqlash",
      requiredName: 'Ism majburiy (kamida 2 belgi)',
      maxBio: 'Maksimum 120 belgi',
      invalidEmail: "Noto'g'ri email",
      invalidButtons: "Nomi bor tugmalarda havola bo'lishi kerak",
    }
    : {
      back: '← Назад',
      title: 'Редактор',
      preview: 'Превью',
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
      premiumThemesHint: 'Премиум-темы доступны только на тарифе Premium',
      buttons: 'Кнопки',
      buttonTitle: 'Название',
      save: 'Сохранить изменения',
      requiredName: 'Имя обязательно (минимум 2 символа)',
      maxBio: 'Максимум 120 символов',
      invalidEmail: 'Некорректный email',
      invalidButtons: 'У всех кнопок с названием должна быть ссылка',
    };
  // Валидация
  const [errors, setErrors] = React.useState<any>({});
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [previewVisible, setPreviewVisible] = React.useState(false);
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
  });
  const [tagInput, setTagInput] = React.useState('');
  const avatarImage = useRetryImageUri(local.avatarUrl);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const isDirty = React.useMemo(() => JSON.stringify(local) !== JSON.stringify(card), [card, local]);

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
        buttons: Array.isArray(card.buttons) ? card.buttons : [],
      });
      setTagInput('');
    }
  }, [card, visible]);

  const updateField = (key: string, value: any) => {
    setLocal((prev: any) => ({ ...prev, [key]: value }));
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
      <View style={[styles.root, { backgroundColor: tokens.phoneBg }]}>
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

        <ScrollView contentContainerStyle={styles.content}>
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

          <View style={[styles.block, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
            <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{text.mainInfo}</Text>
            {/* Имя (обязательно) */}
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
            {/* Bio */}
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
            {/* Телефон, Telegram, Email */}
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
            {/* Нижний хэштег */}
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
            {/* Теги */}
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
            {/* Адрес */}
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
            {/* Индекс */}
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
            {/* Дополнительный телефон */}
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

          {/* Брендинг */}
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
                const locked = option.premium && String(userPlan).toLowerCase() !== 'premium';
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
            {String(userPlan).toLowerCase() !== 'premium' && (
              <Text style={{ color: tokens.textMuted, fontSize: 12, marginTop: 6 }}>{text.premiumThemesHint}</Text>
            )}
          </View>

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

                <TextInput
                  value={button.label}
                  onChangeText={(v) => updateButton(index, { label: v })}
                  placeholder={text.buttonTitle}
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.inlineInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                />
                <View style={styles.bottomRow}>
                  <TextInput
                    value={button.url}
                    onChangeText={(v) => updateButton(index, { url: v })}
                    placeholder='https://...'
                    placeholderTextColor={tokens.textMuted}
                    style={[styles.urlInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                  />
                  <Pressable onPress={() => removeButton(index)} style={styles.removeBtn}>
                    <Trash2 size={15} strokeWidth={1.5} color={tokens.red} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

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

              const payload = { ...local, buttons: fixedButtons };
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
      </View>
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
