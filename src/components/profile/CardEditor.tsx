// Выбор и удаление аватара
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
import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Switch, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Plus, Trash2 } from 'lucide-react-native';

import { ProfileCard, ThemeTokens } from '@/types';
import { BUTTON_ICONS, inferButtonIcon, normalizeButtonIconKey } from '@/components/profile/buttonIcons';
import { CardPreview } from '@/components/profile/CardPreview';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
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

const THEME_OPTIONS: Array<{ id: string; label: string; swatch: string; premium?: boolean }> = [
  { id: 'default_dark', label: 'Default Dark', swatch: '#0a0a0a' },
  { id: 'arctic', label: 'Arctic', swatch: '#f0f5f9', premium: true },
  { id: 'linen', label: 'Linen', swatch: '#f2ede6', premium: true },
  { id: 'marble', label: 'Marble', swatch: '#ffffff', premium: true },
  { id: 'forest', label: 'Forest', swatch: '#0e2010', premium: true },
  { id: 'graphite', label: 'Graphite', swatch: '#23272e', premium: true },
  { id: 'gold', label: 'Gold', swatch: '#f7e9b0', premium: true },
  { id: 'violet', label: 'Violet', swatch: '#e6e6fa', premium: true },
  { id: 'ocean', label: 'Ocean', swatch: '#b3e0f2', premium: true },
  { id: 'sunset', label: 'Sunset', swatch: '#ffb347', premium: true },
  { id: 'mint', label: 'Mint', swatch: '#b6fcd5', premium: true },
  { id: 'coral', label: 'Coral', swatch: '#ff7f50', premium: true },
  { id: 'night', label: 'Night', swatch: '#22223b', premium: true },
];

export function CardEditor({ visible, tokens, card, saving, userPlan, onClose, onPreview, onSave }: CardEditorProps): React.JSX.Element {
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
    customColor: card.customColor || '#111111',
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
      nextErrors.name = 'Имя обязательно (минимум 2 символа)';
    }
    if (local.bio && local.bio.length > MAX_BIO_LENGTH) {
      nextErrors.bio = 'Максимум 120 символов';
    }
    if (local.email && !/^\S+@\S+\.\S+$/.test(local.email)) {
      nextErrors.email = 'Некорректный email';
    }
    if (local.buttons && local.buttons.some((b: any) => b.label && !b.url)) {
      nextErrors.buttons = 'У всех кнопок с названием должна быть ссылка';
    }
    setErrors(nextErrors);
  }, [local]);

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
        customColor: card.customColor || '#111111',
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
  const removeAvatar = () => {
    updateField('avatarUrl', '');
  };

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: tokens.phoneBg }]}>
        <View style={[styles.header, { borderBottomColor: tokens.border }]}>
          <Pressable onPress={() => runThrottled(onClose)}>
            <Text style={[styles.headerAction, { color: tokens.textMuted }]}>← Назад</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: tokens.text }]}>Редактор</Text>
          <Pressable onPress={() => runThrottled(() => onPreview(local))}>
            <Text style={[styles.headerAction, { color: tokens.accent }]}>Превью</Text>
          </Pressable>
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
                <Text style={{ color: tokens.accent }}>Загрузить</Text>
              </Pressable>
              {!!local.avatarUrl && (
                <Pressable onPress={removeAvatar} style={[styles.addBtn, { backgroundColor: tokens.inputBg }]}>
                  <Text style={{ color: tokens.red }}>Удалить</Text>
                </Pressable>
              )}
            </View>
            <Text style={[styles.avatarHint, { color: tokens.textMuted }]}>Загрузите или удалите фото профиля</Text>
          </View>

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>Основная информация</Text>
            {/* Имя (обязательно) */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>Имя *</Text>
              <TextInput
                value={local.name}
                onChangeText={(v) => updateField('name', v)}
                placeholder='Имя'
                placeholderTextColor={tokens.textMuted}
                style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                maxLength={40}
              />
              {errors.name && <Text style={{ color: tokens.red, fontSize: 11 }}>{errors.name}</Text>}
            </View>
            {/* Bio */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>Bio</Text>
              <TextInput
                value={local.bio}
                onChangeText={(v) => updateField('bio', v.slice(0, MAX_BIO_LENGTH))}
                placeholder='О себе (до 120 символов)'
                placeholderTextColor={tokens.textMuted}
                style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, minHeight: 60 }]}
                multiline
                maxLength={MAX_BIO_LENGTH}
              />
              <Text style={{ fontSize: 11, color: tokens.textMuted, alignSelf: 'flex-end' }}>{local.bio.length}/{MAX_BIO_LENGTH}</Text>
              {errors.bio && <Text style={{ color: tokens.red, fontSize: 11 }}>{errors.bio}</Text>}
            </View>
            {/* Должность, Телефон, Telegram, Email */}
            {[
              ['Должность', 'job'],
              ['Телефон', 'phone'],
              ['Telegram', 'telegram'],
              ['Email', 'email'],
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
              <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>Нижний хэштег</Text>
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
              <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>Теги</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder='#Дизайнер'
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.fieldInput, { flex: 1, backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                  onSubmitEditing={addTag}
                />
                <Pressable onPress={addTag} style={[styles.addBtn, { alignSelf: 'center' }]}>
                  <Text style={[styles.addText, { color: tokens.accent }]}>Добавить</Text>
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
              <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>Адрес</Text>
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
              <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>Индекс</Text>
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
              <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>Доп. телефон</Text>
              <TextInput
                value={local.extraPhone}
                onChangeText={(v) => updateField('extraPhone', v)}
                placeholder='+998200001360'
                placeholderTextColor={tokens.textMuted}
                style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
              />
            </View>
          </View>

          {/* Кастомный цвет акцента и брендинг */}
          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>Кастомный цвет акцента</Text>
            <TextInput
              value={local.customColor}
              onChangeText={(v) => updateField('customColor', v)}
              placeholder='#111111'
              placeholderTextColor={tokens.textMuted}
              style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, width: 120 }]}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Switch
                value={local.showBranding}
                onValueChange={(v) => updateField('showBranding', v)}
                trackColor={{ false: tokens.border, true: tokens.accent }}
                thumbColor={local.showBranding ? tokens.accent : tokens.inputBg}
              />
              <Text style={{ color: tokens.text, marginLeft: 8 }}>Скрыть брендинг UNQX</Text>
            </View>
          </View>

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>Тема визитки</Text>
            <View style={styles.themeGrid}>
              {THEME_OPTIONS.map((option) => {
                const locked = option.premium && String(userPlan).toLowerCase() !== 'premium';
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
                    <View style={[styles.themeSwatch, { backgroundColor: option.swatch, borderColor: tokens.border, position: 'relative' }]}
                    >
                      {locked && (
                        <Text style={{
                          position: 'absolute',
                          left: 0, right: 0, top: 0, bottom: 0,
                          textAlign: 'center',
                          textAlignVertical: 'center',
                          color: tokens.textMuted,
                          fontSize: 13,
                          fontWeight: 'bold',
                        }}>🔒</Text>
                      )}
                    </View>
                    <Text style={[styles.themeText, { color: local.theme === option.id ? tokens.text : tokens.textMuted }]} numberOfLines={1}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {String(userPlan).toLowerCase() !== 'premium' && (
              <Text style={{ color: tokens.textMuted, fontSize: 12, marginTop: 6 }}>
                Премиум-темы доступны только на тарифе Premium
              </Text>
            )}
          </View>

          <View style={styles.block}>
            <View style={styles.buttonsHead}>
              <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>{`Кнопки (${local.buttons.filter((b) => b.label).length}/6)`}</Text>
              {local.buttons.length < 6 ? (
                <Pressable onPress={addButton} style={styles.addBtn}>
                  <Plus size={14} strokeWidth={1.5} color={tokens.accent} />
                  <Text style={[styles.addText, { color: tokens.accent }]}>Добавить</Text>
                </Pressable>
              ) : null}
            </View>
            {errors.buttons && <Text style={{ color: tokens.red, fontSize: 11, marginBottom: 4 }}>{errors.buttons}</Text>}

            {local.buttons.map((button, index) => (
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
                  placeholder='Название'
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
              // Фильтруем кнопки: только с label и url
              const filteredButtons = Array.isArray(local.buttons)
                ? local.buttons.filter((b) => b.label && b.url)
                : [];
              const payload = { ...local, buttons: filteredButtons };
              console.log('Saving card:', payload); // Для отладки
              onSave(payload);
            }}
            style={[styles.saveBtn, { backgroundColor: tokens.accent, opacity: saving || !isDirty || Object.keys(errors).length > 0 ? 0.5 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator color={tokens.accentText} />
            ) : (
              <Text style={[styles.saveText, { color: tokens.accentText }]}>Сохранить изменения</Text>
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
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeBtn: {
    width: '48%',
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
  },
  themeSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  themeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlignVertical: 'center',
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
