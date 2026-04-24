import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';

import { CardThemeBackdrop } from '@/components/profile/CardThemeBackdrop';
import { Label, Sparkline } from '@/components/ui/shared';
import { resolveProfileCardTheme } from '@/design/cardThemes';
import { ProfileCard, ThemeTokens } from '@/types';

interface WidgetPreviewProps {
  card: ProfileCard;
  totalTaps: number;
  tokens: ThemeTokens;
}

export function WidgetPreview({ card, totalTaps, tokens }: WidgetPreviewProps): React.JSX.Element {
  const today = Math.max(1, Math.round(totalTaps / 10));
  const theme = resolveProfileCardTheme(card.theme);
  const themeTextStyle = { fontFamily: theme.fontFamily } as const;

  const copyInstruction = async () => {
    await Clipboard.setStringAsync('Виджеты добавляются через системное меню iOS/Android. Сделай системный скриншот и передай дизайнеру.');
    Alert.alert('Инструкция', 'Текст скопирован в буфер обмена');
  };

  return (
    <View style={styles.root}>
      <Label color={tokens.textMuted}>Виджеты для экрана</Label>

      <View style={styles.grid}>
        <View
          style={[
            styles.widgetCard,
            {
              borderColor: theme.cardBorder,
              borderRadius: Math.max(18, theme.cardRadius - 2),
              shadowColor: theme.shadowColor,
              shadowOpacity: theme.shadowOpacity * 0.9,
              shadowRadius: theme.shadowRadius * 0.8,
              shadowOffset: { width: 0, height: theme.shadowOffsetY },
              elevation: theme.elevation,
            },
          ]}
        >
          <LinearGradient colors={theme.cardGradient as [string, string]} style={[StyleSheet.absoluteFill, { borderRadius: Math.max(18, theme.cardRadius - 2) }]} />
          <CardThemeBackdrop theme={theme} rounded={Math.max(18, theme.cardRadius - 2)} />
          <Text style={[styles.widgetKicker, themeTextStyle, { color: theme.roleColor }]}>ТАПОВ</Text>
          <Text style={[styles.widgetBig, themeTextStyle, { color: theme.nameColor }]}>{totalTaps}</Text>
          <Text style={[styles.widgetMeta, themeTextStyle, { color: theme.emailColor }]}>unqx.uz</Text>
          <Text style={[styles.widgetMeta2, themeTextStyle, { color: theme.mutedColor }]}>Сегодня</Text>
        </View>

        <View
          style={[
            styles.widgetCard,
            {
              borderColor: theme.surfaceBorder,
              backgroundColor: theme.surfaceBg,
              borderRadius: Math.max(18, theme.cardRadius - 2),
            },
          ]}
        >
          <Text style={[styles.widgetKicker, themeTextStyle, { color: theme.roleColor }]}>{card.slug}</Text>
          <View>
            <Text style={[styles.widgetBig2, themeTextStyle, { color: theme.scoreValueColor }]}>{today}</Text>
            <Text style={[styles.widgetMeta, themeTextStyle, { color: theme.emailColor }]}>тапа сегодня</Text>
            <View style={styles.tinyBars}>
              {[4, 7, 3, 9, 6, 8, 5].map((h, i) => (
                <View
                  key={`b-${i}`}
                  style={[
                    styles.tinyBar,
                    {
                      height: (h / 9) * 22,
                      backgroundColor: i === 6 ? theme.widgetAccent : theme.scoreBarTrack,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.widgetWide,
          {
            borderColor: theme.surfaceBorder,
            backgroundColor: theme.surfaceBg,
            borderRadius: Math.max(18, theme.cardRadius - 2),
          },
        ]}
      >
        <View>
          <Text style={[styles.widgetKicker, themeTextStyle, { color: theme.roleColor }]}>{`UNQX · ${card.slug}`}</Text>
          <Text style={[styles.widgetWideBig, themeTextStyle, { color: theme.scoreValueColor }]}>{totalTaps}</Text>
          <Text style={[styles.widgetMeta, themeTextStyle, { color: theme.emailColor }]}>всего тапов · ↑ +32%</Text>
        </View>
        <Sparkline data={[8, 14, 9, 18, 22, 16, 20, 13, 24, 19, 28]} color={theme.widgetAccent} width={88} height={40} />
      </View>

      <Text style={[styles.caption, { color: tokens.textMuted }]}>Виджеты добавляются через системное меню iOS/Android. Скопируй скриншот и покажи дизайнеру.</Text>

      <Pressable onPress={() => void copyInstruction()} style={[styles.copyBtn, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
        <Text style={[styles.copyText, { color: tokens.text }]}>Скопировать инструкцию</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  widgetCard: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 140,
  },
  widgetWide: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 110,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  widgetKicker: {
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  widgetBig: {
    fontSize: 34,
    lineHeight: 34,
    fontFamily: 'Inter_600SemiBold',
  },
  widgetBig2: {
    fontSize: 28,
    lineHeight: 28,
    fontFamily: 'Inter_600SemiBold',
  },
  widgetWideBig: {
    fontSize: 30,
    lineHeight: 30,
    fontFamily: 'Inter_600SemiBold',
  },
  widgetMeta: {
    marginTop: 3,
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
  },
  widgetMeta2: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
  },
  tinyBars: {
    marginTop: 8,
    height: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  tinyBar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  caption: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  copyBtn: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
