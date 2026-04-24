import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/ui/Button';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { LanguageCode } from '@/constants/messages';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { useThemeContext } from '@/theme/ThemeProvider';
import { ThemeTokens } from '@/types';

interface LanguagePickerScreenProps {
  tokens: ThemeTokens;
  onComplete: () => void;
}

const LANGUAGES: { code: LanguageCode; flag: string; label: string; sublabel: string }[] = [
  { code: 'ru', flag: 'RU', label: 'Русский', sublabel: 'Основной язык интерфейса' },
  { code: 'uz', flag: 'UZ', label: "O'zbekcha", sublabel: 'Interfeysning asosiy tili' },
];

export function LanguagePickerScreen({ tokens, onComplete }: LanguagePickerScreenProps): React.JSX.Element {
  const { setLanguage } = useLanguageContext();
  const [selected, setSelected] = React.useState<LanguageCode | null>(null);
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  const handleSelect = React.useCallback((code: LanguageCode) => {
    setSelected(code);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, []);

  const handleContinue = React.useCallback(() => {
    if (!selected) return;
    setLanguage(selected);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onComplete();
  }, [onComplete, selected, setLanguage]);

  return (
    <AuthScaffold
      tokens={tokens}
      eyebrow='UNQX / Language'
      title={isDark ? 'Выберите язык интерфейса' : 'Choose your language'}
      subtitle='Приложение сохранит выбор и синхронизирует тексты onboarding, auth и profile flow.'
    >
      <View style={styles.cards}>
        {LANGUAGES.map((lang) => {
          const isActive = selected === lang.code;
          return (
            <Pressable
              key={lang.code}
              style={[
                styles.card,
                {
                  backgroundColor: isActive ? `${tokens.accent}12` : tokens.surface,
                  borderColor: isActive ? tokens.accent : tokens.border,
                },
              ]}
              onPress={() => handleSelect(lang.code)}
            >
              <View style={[styles.flagPill, { backgroundColor: isActive ? tokens.accent : tokens.inputBg }]}>
                <Text style={[styles.flag, { color: isActive ? tokens.accentText : tokens.text }]}>{lang.flag}</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.langLabel, { color: tokens.text }]}>{lang.label}</Text>
                <Text style={[styles.langSub, { color: tokens.textMuted }]}>{lang.sublabel}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: isActive ? tokens.accent : tokens.textMuted,
                    backgroundColor: isActive ? tokens.accent : 'transparent',
                  },
                ]}
              >
                {isActive ? <View style={[styles.radioInner, { backgroundColor: tokens.accentText }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button tokens={tokens} label='Продолжить / Davom etish' onPress={handleContinue} disabled={!selected} size='lg' />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.2,
    gap: 14,
  },
  flagPill: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  cardText: {
    flex: 1,
  },
  langLabel: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  langSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    marginTop: 18,
  },
});
