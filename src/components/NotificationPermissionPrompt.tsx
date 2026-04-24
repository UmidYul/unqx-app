import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BellRing } from 'lucide-react-native';

import { resolveShadowStyle } from '@/design/appDesign';
import { useThemeContext } from '@/theme/ThemeProvider';
import { ThemeTokens } from '@/types';

interface NotificationPermissionPromptProps {
  visible: boolean;
  tokens: ThemeTokens;
  onAllow: () => void;
  onLater: () => void;
}

export function NotificationPermissionPrompt({
  visible,
  tokens,
  onAllow,
  onLater,
}: NotificationPermissionPromptProps): React.JSX.Element {
  const { design } = useThemeContext();

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: design.authSurface.backgroundColor,
              borderColor: design.authSurface.borderColor,
            },
            resolveShadowStyle(design.authSurface),
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${tokens.accent}14` }]}>
            <BellRing size={20} strokeWidth={1.5} color={tokens.accent} />
          </View>
          <Text style={[styles.title, { color: tokens.text }]}>Включить push-уведомления?</Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
            Получай уведомления о новых тапах, статусе заказа и еженедельных отчётах.
          </Text>

          <Pressable style={[styles.primaryBtn, { backgroundColor: tokens.accent }]} onPress={onAllow}>
            <Text style={[styles.primaryText, { color: tokens.accentText }]}>Разрешить</Text>
          </Pressable>
          <Pressable style={[styles.secondaryBtn, { borderColor: tokens.border }]} onPress={onLater}>
            <Text style={[styles.secondaryText, { color: tokens.text }]}>Не сейчас</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
