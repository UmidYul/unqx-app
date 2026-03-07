import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, Plus, Trash2 } from 'lucide-react-native';

import { ProfileCard, ThemeTokens } from '@/types';
import { BUTTON_ICONS, inferButtonIcon, normalizeButtonIconKey } from '@/components/profile/buttonIcons';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
import { runThrottled } from '@/utils/navigation';

interface CardEditorProps {
  visible: boolean;
  tokens: ThemeTokens;
  card: ProfileCard;
  saving: boolean;
  onClose: () => void;
  onPreview: (card: ProfileCard) => void;
  onSave: (card: ProfileCard) => void;
}

const MAX_BUTTONS = 6;

const THEME_OPTIONS: Array<{ id: ProfileCard['theme']; label: string; swatch: string }> = [
  { id: 'default_dark', label: 'Default Dark', swatch: '#0a0a0a' },
  { id: 'arctic', label: 'Arctic', swatch: '#f0f5f9' },
  { id: 'linen', label: 'Linen', swatch: '#f2ede6' },
  { id: 'marble', label: 'Marble', swatch: '#ffffff' },
  { id: 'forest', label: 'Forest', swatch: '#0e2010' },
];

export function CardEditor({ visible, tokens, card, saving, onClose, onPreview, onSave }: CardEditorProps): React.JSX.Element {
  const [local, setLocal] = React.useState<ProfileCard>(card);
  const avatarImage = useRetryImageUri(local.avatarUrl);
  const isDirty = React.useMemo(() => JSON.stringify(local) !== JSON.stringify(card), [card, local]);

  React.useEffect(() => {
    if (visible) {
      setLocal(card);
    }
  }, [card, visible]);

  const updateField = <K extends keyof ProfileCard>(key: K, value: ProfileCard[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const updateButton = (index: number, patch: Partial<ProfileCard['buttons'][number]>) => {
    setLocal((prev) => ({
      ...prev,
      buttons: prev.buttons.map((button, i) => {
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

  const removeButton = (index: number) => {
    setLocal((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  };

  const addButton = () => {
    setLocal((prev) => {
      if (prev.buttons.length >= MAX_BUTTONS) {
        return prev;
      }

      return {
        ...prev,
        buttons: [...prev.buttons, { icon: 'website', label: '', url: '' }],
      };
    });
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
              {avatarImage.showImage && avatarImage.imageUri ? (
                <Image
                  key={`${local.avatarUrl}:${avatarImage.retryCount}`}
                  source={{ uri: avatarImage.imageUri }}
                  style={styles.avatarImage}
                  onError={avatarImage.onError}
                />
              ) : (
                <Text style={[styles.avatarText, { color: tokens.accent }]}>{local.name[0] || 'A'}</Text>
              )}
              <View style={[styles.avatarPlus, { backgroundColor: tokens.accent }]}>
                <Camera size={12} strokeWidth={1.5} color={tokens.accentText} />
              </View>
            </View>
            <Text style={[styles.avatarHint, { color: tokens.textMuted }]}>Нажми чтобы сменить фото</Text>
          </View>

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>Основная информация</Text>
            {[
              ['Имя', 'name'],
              ['Должность', 'job'],
              ['Телефон', 'phone'],
              ['Telegram', 'telegram'],
              ['Email', 'email'],
            ].map(([label, key]) => (
              <View key={key} style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{label}</Text>
                <TextInput
                  value={String(local[key as keyof ProfileCard] ?? '')}
                  onChangeText={(v) => updateField(key as keyof ProfileCard, v as never)}
                  placeholder={String(label)}
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.fieldInput, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text }]}
                />
              </View>
            ))}
          </View>

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: tokens.textMuted }]}>Тема визитки</Text>
            <View style={styles.themeGrid}>
              {THEME_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => updateField('theme', option.id)}
                  style={[
                    styles.themeBtn,
                    {
                      borderColor: local.theme === option.id ? tokens.borderStrong : tokens.border,
                      backgroundColor: local.theme === option.id ? tokens.surface : tokens.inputBg,
                    },
                  ]}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: option.swatch, borderColor: tokens.border }]} />
                  <Text style={[styles.themeText, { color: local.theme === option.id ? tokens.text : tokens.textMuted }]} numberOfLines={1}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
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
            disabled={saving || !isDirty}
            onPress={() => onSave(local)}
            style={[styles.saveBtn, { backgroundColor: tokens.accent, opacity: saving || !isDirty ? 0.5 : 1 }]}
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
