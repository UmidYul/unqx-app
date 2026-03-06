import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { MESSAGES } from '@/constants/messages';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, sendEmailOtpWithApi, verifyEmailWithApi } from '@/services/authSession';
import { validateEmail, validateOtpCode } from '@/services/authValidation';
import { useThemeContext } from '@/theme/ThemeProvider';

function paramToString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export default function VerifyEmailPage(): React.JSX.Element {
  const { safeReplace, safePush } = useThrottledNavigation();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const { tokens } = useThemeContext();
  const { ready, signedIn } = useAuthStatus();

  const [email, setEmail] = React.useState(paramToString(params.email));
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const lastAutoSubmitKeyRef = React.useRef<string>('');

  const submit = React.useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '');

    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    const codeError = validateOtpCode(normalizedCode);
    if (codeError) {
      setError(codeError);
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await verifyEmailWithApi(normalizedEmail, normalizedCode);
      if (result.signedIn) {
        safeReplace('/(tabs)/home');
        return;
      }
      setInfo(result.message ?? MESSAGES.auth.emailVerifiedLogin);
    } catch (e) {
      if (e instanceof AuthSessionError) {
        setError(e.message);
        return;
      }
      setError(e instanceof Error ? e.message : MESSAGES.auth.verifyError);
    } finally {
      setLoading(false);
    }
  }, [code, email, safeReplace]);

  const resend = React.useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const result = await sendEmailOtpWithApi(normalizedEmail);
      setInfo(result.message);
    } catch (e) {
      if (e instanceof AuthSessionError) {
        setError(e.message);
        return;
      }
      setError(e instanceof Error ? e.message : MESSAGES.auth.otpSendError);
    } finally {
      setResending(false);
    }
  }, [email]);

  React.useEffect(() => {
    if (loading || resending) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '');
    if (normalizedCode.length !== 6) {
      return;
    }

    const key = `${normalizedEmail}|${normalizedCode}`;
    if (lastAutoSubmitKeyRef.current === key) {
      return;
    }

    lastAutoSubmitKeyRef.current = key;
    void submit();
  }, [code, email, loading, resending, submit]);

  if (!ready) {
    return <AuthLoadingScreen tokens={tokens} title='Проверка сессии...' />;
  }

  if (signedIn) {
    return <Redirect href='/(tabs)/home' />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: tokens.bg }]}
    >
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: tokens.textMuted }]}>UNQX</Text>
        <Text style={[styles.title, { color: tokens.text }]}>{MESSAGES.ui.auth.verifyEmailTitle}</Text>
        <Text style={[styles.subtitle, { color: tokens.textSub }]}>{MESSAGES.ui.auth.verifyEmailSubtitle}</Text>

        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder='Email'
            placeholderTextColor={tokens.textMuted}
            autoCapitalize='none'
            keyboardType='email-address'
            autoCorrect={false}
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text },
            ]}
          />

          <OtpCodeInput value={code} onChange={setCode} tokens={tokens} disabled={loading || resending} />

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
              <Text style={[styles.submitText, { color: tokens.accentText }]}>Подтвердить</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => void resend()}
            disabled={resending}
            style={[styles.secondary, { borderColor: tokens.border, opacity: resending ? 0.5 : 1 }]}
          >
            {resending ? (
              <ActivityIndicator color={tokens.text} />
            ) : (
              <Text style={[styles.secondaryText, { color: tokens.text }]}>Отправить код заново</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: tokens.textMuted }]}>Уже подтверждено?</Text>
          <Pressable onPress={() => safePush('/login')}>
            <Text style={[styles.footerLink, { color: tokens.text }]}>Войти</Text>
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
