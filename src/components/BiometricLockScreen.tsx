import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

import { BiometricType, useBiometrics } from '@/hooks/useBiometrics';
import { ThemeTokens } from '@/types';

interface BiometricLockScreenProps {
  visible: boolean;
  tokens: ThemeTokens;
  biometricType: BiometricType;
  onAuthenticated: () => void;
  onOtherMethod: () => void;
}

export function BiometricLockScreen({
  visible,
  tokens,
  biometricType,
  onAuthenticated,
  onOtherMethod,
}: BiometricLockScreenProps): React.JSX.Element | null {
  const { authenticate } = useBiometrics();
  const [pending, setPending] = React.useState(false);
  const Icon = biometricType === 'Face ID' ? ScanFace : Fingerprint;

  const runAuth = React.useCallback(async () => {
    if (pending) return;
    setPending(true);
    const success = await authenticate('Подтвердите личность');
    setPending(false);
    if (success) {
      onAuthenticated();
    }
  }, [authenticate, onAuthenticated, pending]);

  React.useEffect(() => {
    if (!visible) return;
    void runAuth();
  }, [runAuth, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BlurView tint='dark' intensity={55} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.card, { backgroundColor: tokens.phoneBg, borderColor: tokens.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: `${tokens.accent}18`, borderColor: `${tokens.accent}55` }]}>
          <Icon size={34} color={tokens.accent} strokeWidth={1.6} />
        </View>
        <Text style={[styles.title, { color: tokens.text }]}>Подтвердите личность</Text>
        <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
          {biometricType ? `Используйте ${biometricType}, чтобы открыть UNQX` : 'Используйте биометрию, чтобы открыть UNQX'}
        </Text>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: tokens.accent, opacity: pending ? 0.6 : 1 }]}
          onPress={() => void runAuth()}
          disabled={pending}
        >
          {pending ? <ActivityIndicator color={tokens.accentText} /> : <Text style={[styles.primaryText, { color: tokens.accentText }]}>Разблокировать</Text>}
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onOtherMethod}>
          <Text style={[styles.secondaryText, { color: tokens.textSub }]}>Другой способ</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  primaryButton: {
    marginTop: 20,
    minHeight: 48,
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
