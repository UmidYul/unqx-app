import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Label, Sparkline } from '@/components/ui/shared';
import { ProfileCard, ThemeTokens } from '@/types';

interface WidgetPreviewProps {
  card: ProfileCard;
  totalTaps: number;
  tokens: ThemeTokens;
}

export function WidgetPreview({ card, totalTaps, tokens }: WidgetPreviewProps): React.JSX.Element {
  const today = Math.max(1, Math.round(totalTaps / 10));

  const copyInstruction = async () => {
    await Clipboard.setStringAsync('Виджеты добавляются через системное меню iOS/Android. Сделай системный скриншот и передай дизайнеру.');
    Alert.alert('Инструкция', 'Текст скопирован в буфер обмена');
  };

  return (
    <View style={styles.root}>
      <Label color={tokens.textMuted}>Виджеты для экрана</Label>

      <View style={styles.grid}>
        <View style={styles.widgetSquareA}>
          <Text style={styles.widgetKicker}>ТАПОВ</Text>
          <Text style={styles.widgetBig}>{totalTaps}</Text>
          <Text style={styles.widgetMeta}>unqx.uz</Text>
          <Text style={styles.widgetMeta2}>Сегодня</Text>
        </View>

        <View style={styles.widgetSquareB}>
          <Text style={styles.widgetKicker}>{card.slug}</Text>
          <View>
            <Text style={styles.widgetBig2}>{today}</Text>
            <Text style={styles.widgetMeta}>тапа сегодня</Text>
            <View style={styles.tinyBars}>
              {[4, 7, 3, 9, 6, 8, 5].map((h, i) => (
                <View key={`b-${i}`} style={[styles.tinyBar, { height: (h / 9) * 22, backgroundColor: i === 6 ? '#e8dfc8' : 'rgba(255,255,255,0.2)' }]} />
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.widgetWide}>
        <View>
          <Text style={styles.widgetKicker}>{`UNQX · ${card.slug}`}</Text>
          <Text style={styles.widgetWideBig}>{totalTaps}</Text>
          <Text style={styles.widgetMeta}>всего тапов · ↑ +32%</Text>
        </View>
        <Sparkline data={[8, 14, 9, 18, 22, 16, 20, 13, 24, 19, 28]} color='#e8dfc8' width={80} height={40} />
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
  widgetSquareA: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 140,
    backgroundColor: '#111111',
  },
  widgetSquareB: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 140,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  widgetWide: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 110,
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  widgetKicker: {
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  widgetBig: {
    fontSize: 34,
    lineHeight: 34,
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
  widgetBig2: {
    fontSize: 28,
    lineHeight: 28,
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
  widgetWideBig: {
    fontSize: 30,
    lineHeight: 30,
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
  widgetMeta: {
    marginTop: 3,
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
  widgetMeta2: {
    marginTop: 2,
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
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
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
