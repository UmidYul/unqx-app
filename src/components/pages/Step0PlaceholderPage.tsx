import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/AppShell';
import { ThemeTokens } from '@/types';
import { DotsLoader, Label, Pill } from '@/components/ui/shared';

interface Step0PlaceholderPageProps {
  title: string;
  description: string;
  tokens: ThemeTokens;
}

export function Step0PlaceholderPage({ title, description, tokens }: Step0PlaceholderPageProps): React.JSX.Element {
  return (
    <AppShell title={title} tokens={tokens}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
          <Label color={tokens.textMuted}>Step 0</Label>
          <Text style={[styles.heading, { color: tokens.text }]}>Фундамент готов</Text>
          <Text style={[styles.description, { color: tokens.textSub }]}>{description}</Text>
          <View style={styles.badgesRow}>
            <Pill color={tokens.accentText} bg={tokens.accent}>Expo Router</Pill>
            <Pill color={tokens.green} bg={tokens.greenBg}>TypeScript strict</Pill>
          </View>
          <View style={styles.loaderRow}>
            <DotsLoader color={tokens.accent} />
            <Text style={[styles.loaderText, { color: tokens.textMuted }]}>Шаг 1 ожидает команду</Text>
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  heading: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  loaderRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
