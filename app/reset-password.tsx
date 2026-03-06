import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { MESSAGES } from '@/constants/messages';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, resetPasswordWithApi } from '@/services/authSession';
import { validateConfirmPassword, validateEmail, validateOtpCode, validatePassword } from '@/services/authValidation';
import { useThemeContext } from '@/theme/ThemeProvider';

function paramToString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export default function ResetPasswordPage(): React.JSX.Element {
  const { safePush, safeReplace } = useThrottledNavigation();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const { tokens } = useThemeContext();

  const [email, setEmail] = React.useState(paramToString(params.email));
  const [code, setCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const lastAutoSubmitKeyRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!done) {
      return;
    }

    const timerId = setTimeout(() => {
      safeReplace('/login');
    }, 1500);

    return () => clearTimeout(timerId);
  }, [done, safeReplace]);

  const submit = React.useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '');

    const validations = [
      validateEmail(normalizedEmail),
      validateOtpCode(normalizedCode),
      validatePassword(newPassword),
      validateConfirmPassword(newPassword, confirmPassword),
    ];
    const firstError = validations.find((message) => Boolean(message));
    if (firstError) {
      setError(firstError);
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await resetPasswordWithApi({
        email: normalizedEmail,
        code: normalizedCode,
        newPassword,
        confirmPassword,
      });
      setDone(result.ok);
      setInfo(result.message);
    } catch (e) {
      if (e instanceof AuthSessionError) {
        setError(e.message);
        return;
      }
      setError(e instanceof Error ? e.message : MESSAGES.auth.resetPasswordError);
    } finally {
      setLoading(false);
    }
  }, [code, confirmPassword, email, newPassword]);

  React.useEffect(() => {
    if (loading || done) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '');
    if (normalizedCode.length !== 6) {
      return;
    }

    if (validateEmail(normalizedEmail) || validatePassword(newPassword) || validateConfirmPassword(newPassword, confirmPassword)) {
      return;
    }

    const key = `${normalizedEmail}|${normalizedCode}|${newPassword}|${confirmPassword}`;
    if (lastAutoSubmitKeyRef.current === key) {
      return;
    }

    lastAutoSubmitKeyRef.current = key;
    void submit();
  }, [code, confirmPassword, done, email, loading, newPassword, submit]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: tokens.bg }]}
    >
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: tokens.textMuted }]}>UNQX</Text>
        <Text style={[styles.title, { color: tokens.text }]}>{MESSAGES.ui.auth.resetPasswordTitle}</Text>
        <Text style={[styles.subtitle, { color: tokens.textSub }]}>{MESSAGES.ui.auth.resetPasswordSubtitle}</Text>

        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={MESSAGES.ui.auth.emailPlaceholder}
            placeholderTextColor={tokens.textMuted}
            autoCapitalize='none'
            keyboardType='email-address'
            autoCorrect={false}
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text },
            ]}
          />

          <OtpCodeInput value={code} onChange={setCode} tokens={tokens} disabled={loading || done} />

          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={MESSAGES.ui.auth.newPasswordPlaceholder}
            placeholderTextColor={tokens.textMuted}
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text },
            ]}
          />

          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={MESSAGES.ui.auth.newPasswordConfirmPlaceholder}
            placeholderTextColor={tokens.textMuted}
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text },
            ]}
          />

          {error ? <Text style={[styles.error, { color: tokens.red }]}>{error}</Text> : null}
          {info ? <Text style={[styles.info, { color: tokens.green }]}>{info}</Text> : null}

          <Pressable
            onPress={() => void submit()}
            disabled={loading}
            style={[styles.submit, { backgroundColor: tokens.accent, opacity: loading ? 0.5 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color={tokens.accentText} />
            ) : (
              <Text style={[styles.submitText, { color: tokens.accentText }]}>{MESSAGES.ui.auth.resetSubmit}</Text>
            )}
          </Pressable>

          {done ? (
            <Text style={[styles.redirectHint, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.resetRedirectHint}</Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.resetNoCode}</Text>
          <Pressable onPress={() => safePush('/forgot-password')}>
            <Text style={[styles.footerLink, { color: tokens.text }]}>{MESSAGES.ui.auth.resetNoCodeAction}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
  },
  title: {
    marginTop: 10,
    fontSize: 36,
    lineHeight: 38,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  form: {
    marginTop: 24,
    gap: 10,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  info: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  submit: {
    marginTop: 4,
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  secondary: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  redirectHint: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  footerLink: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
