import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { Button } from '@/components/ui/Button';
import { MESSAGES } from '@/constants/messages';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, sendEmailOtpWithApi, verifyEmailWithApi } from '@/services/authSession';
import { validateEmail, validateOtpCode } from '@/services/authValidation';
import { useThemeContext } from '@/theme/ThemeProvider';
import { toUserErrorMessage } from '@/utils/errorMessages';

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
        setError(toUserErrorMessage(e, MESSAGES.auth.verifyError));
        return;
      }
      setError(toUserErrorMessage(e, MESSAGES.auth.verifyError));
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
        setError(toUserErrorMessage(e, MESSAGES.auth.otpSendError));
        return;
      }
      setError(toUserErrorMessage(e, MESSAGES.auth.otpSendError));
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
    return <AuthLoadingScreen tokens={tokens} title={MESSAGES.ui.auth.sessionChecking} />;
  }

  if (signedIn) {
    return <Redirect href='/(tabs)/home' />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: tokens.phoneBg }]}
    >
      <AuthScaffold
        tokens={tokens}
        eyebrow='UNQX / Verify Email'
        title={MESSAGES.ui.auth.verifyEmailTitle}
        subtitle={MESSAGES.ui.auth.verifyEmailSubtitle}
        topAction={{ label: 'Назад', onPress: () => safePush('/login') }}
        footer={(
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.verifyAlreadyDone}</Text>
            <Pressable onPress={() => safePush('/login')}>
              <Text style={[styles.footerLink, { color: tokens.text }]}>{MESSAGES.ui.auth.verifyAlreadyDoneAction}</Text>
            </Pressable>
          </View>
        )}
      >
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

          <OtpCodeInput value={code} onChange={setCode} tokens={tokens} disabled={loading || resending} />

          {error ? <Text style={[styles.error, { color: tokens.red }]}>{error}</Text> : null}
          {info ? <Text style={[styles.info, { color: tokens.green }]}>{info}</Text> : null}

          <Button tokens={tokens} label={MESSAGES.ui.auth.verifySubmit} onPress={() => void submit()} loading={loading} size='lg' />
          <Button tokens={tokens} label={MESSAGES.ui.auth.verifyResend} onPress={() => void resend()} loading={resending} variant='secondary' size='lg' />
        </View>
      </AuthScaffold>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    gap: 12,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  error: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  info: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
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
