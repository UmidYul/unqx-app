import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageCode } from '@/constants/messages';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { getBrandLogoSource } from '@/lib/brandAssets';
import { useThemeContext } from '@/theme/ThemeProvider';
import { ThemeTokens } from '@/types';

interface LanguagePickerScreenProps {
    tokens: ThemeTokens;
    onComplete: () => void;
}

const LANGUAGES: { code: LanguageCode; flag: string; label: string }[] = [
    { code: 'ru', flag: '🇷🇺', label: 'Русский' },
    { code: 'uz', flag: '🇺🇿', label: "O'zbekcha" },
];

export function LanguagePickerScreen({ tokens, onComplete }: LanguagePickerScreenProps): React.JSX.Element {
    const { theme } = useThemeContext();
    const isDark = theme === 'dark';
    const insets = useSafeAreaInsets();
    const { setLanguage } = useLanguageContext();
    const [selected, setSelected] = React.useState<LanguageCode | null>(null);

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
        <View
            style={[
                styles.container,
                {
                    backgroundColor: tokens.bg,
                    paddingTop: insets.top + 40,
                    paddingBottom: Math.max(32, insets.bottom + 16),
                },
            ]}
        >
            <View style={styles.header}>
                <View style={[styles.logoWrap, { backgroundColor: `${tokens.accent}15`, borderColor: `${tokens.accent}45` }]}>
                    <Image source={getBrandLogoSource(isDark)} style={styles.logo} resizeMode="contain" />
                </View>

                <Text style={[styles.welcome, { color: tokens.text }]}>Добро пожаловать</Text>
                <Text style={[styles.welcomeSub, { color: tokens.textMuted }]}>Xush kelibsiz</Text>

                <Text style={[styles.chooseLabel, { color: tokens.textSub }]}>
                    Выберите язык / Tilni tanlang
                </Text>
            </View>

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
                                    borderWidth: isActive ? 2 : 1,
                                },
                            ]}
                            onPress={() => handleSelect(lang.code)}
                        >
                            <Text style={styles.flag}>{lang.flag}</Text>
                            <Text style={[styles.langLabel, { color: tokens.text }]}>{lang.label}</Text>
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
                <Pressable
                    style={[
                        styles.continueBtn,
                        {
                            backgroundColor: tokens.accent,
                            opacity: selected ? 1 : 0.35,
                        },
                    ]}
                    onPress={handleContinue}
                    disabled={!selected}
                >
                    <Text style={[styles.continueText, { color: tokens.accentText }]}>
                        Продолжить / Davom etish
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoWrap: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    logo: {
        width: 76,
        height: 76,
        borderRadius: 16,
    },
    welcome: {
        fontSize: 30,
        lineHeight: 36,
        fontFamily: 'Inter_600SemiBold',
        textAlign: 'center',
    },
    welcomeSub: {
        fontSize: 20,
        lineHeight: 28,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
        marginTop: 4,
    },
    chooseLabel: {
        fontSize: 14,
        lineHeight: 20,
        fontFamily: 'Inter_500Medium',
        textAlign: 'center',
        marginTop: 28,
    },
    cards: {
        gap: 14,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 16,
        gap: 16,
    },
    flag: {
        fontSize: 32,
    },
    langLabel: {
        flex: 1,
        fontSize: 18,
        fontFamily: 'Inter_600SemiBold',
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
        flex: 1,
        justifyContent: 'flex-end',
    },
    continueBtn: {
        minHeight: 54,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueText: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
    },
});
