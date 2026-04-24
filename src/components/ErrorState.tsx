import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

import { MESSAGES } from '@/constants/messages';
import { resolveShadowStyle } from '@/design/appDesign';
import { useThemeContext } from '@/theme/ThemeProvider';
import { ThemeTokens } from '@/types';

export function ErrorState({
  onRetry,
  tokens,
  text = MESSAGES.common.loadFailed,
}: {
  onRetry: () => void;
  tokens: ThemeTokens;
  text?: string;
}): React.JSX.Element {
  const { design } = useThemeContext();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: design.elevatedSurface.backgroundColor,
          borderColor: `${tokens.red}22`,
        },
        resolveShadowStyle(design.elevatedSurface),
      ]}
    >
      <Text style={[styles.text, { color: tokens.textMuted }]}>{text}</Text>
      <Pressable style={[styles.button, { borderColor: tokens.border, backgroundColor: tokens.surface }]} onPress={onRetry}>
        <RefreshCw size={14} color={tokens.text} strokeWidth={1.5} />
        <Text style={[styles.btnText, { color: tokens.text }]}>Повторить</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderRadius: 28,
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
