import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

import { ThemeTokens } from '@/types';
import { useThemeContext } from '@/theme/ThemeProvider';
import { resolveShadowStyle } from '@/design/appDesign';

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
  const { design } = useThemeContext();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: design.elevatedSurface.backgroundColor,
          borderColor: design.elevatedSurface.borderColor,
        },
        resolveShadowStyle(design.elevatedSurface),
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tokens.pageTint, borderColor: tokens.border }]}>
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
    paddingVertical: 24,
    borderWidth: 1,
    borderRadius: 28,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  button: {
    marginTop: 18,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
