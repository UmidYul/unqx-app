import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

import { ThemeTokens } from '@/types';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tokens: ThemeTokens;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon: Icon, title, subtitle, tokens, action }: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <Icon size={22} strokeWidth={1.5} color={tokens.textMuted} />
      </View>
      <Text style={[styles.title, { color: tokens.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: tokens.textMuted }]}>{subtitle}</Text>
      {action ? (
        <Pressable style={[styles.button, { backgroundColor: tokens.accent, borderColor: tokens.accent }]} onPress={action.onPress}>
          <Text style={[styles.buttonText, { color: tokens.accentText }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  button: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
