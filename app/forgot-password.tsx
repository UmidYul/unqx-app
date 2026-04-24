import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { Button } from '@/components/ui/Button';
import { MESSAGES } from '@/constants/messages';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, forgotPasswordWithApi } from '@/services/authSession';
import { validateEmail } from '@/services/authValidation';
import { useThemeContext } from '@/theme/ThemeProvider';
import { toUserErrorMessage } from '@/utils/errorMessages';

export default function ForgotPasswordPage(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const { safePush } = useThrottledNavigation();

  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string>('');

  const submit = React.useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await forgotPasswordWithApi(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setInfo(result.message);
      safePush(`/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (e) {
      if (e instanceof AuthSessionError) {
        setError(toUserErrorMessage(e, MESSAGES.auth.otpSendError));
        return;
      }
      setError(toUserErrorMessage(e, MESSAGES.auth.otpSendError));
    } finally {
      setLoading(false);
    }
  }, [email, safePush]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: tokens.phoneBg }]}
    >
      <AuthScaffold
        tokens={tokens}
        eyebrow='UNQX / Recovery'
        title={MESSAGES.ui.auth.forgotPasswordTitle}
        subtitle={MESSAGES.ui.auth.forgotPasswordSubtitle}
        topAction={{ label: 'Назад к входу', onPress: () => safePush('/login') }}
        footer={(
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.forgotRemembered}</Text>
            <Pressable onPress={() => safePush('/login')}>
              <Text style={[styles.footerLink, { color: tokens.text }]}>{MESSAGES.ui.auth.forgotRememberedAction}</Text>
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

          {error ? <Text style={[styles.error, { color: tokens.red }]}>{error}</Text> : null}
          {info ? <Text style={[styles.info, { color: tokens.green }]}>{info}</Text> : null}

          <Button tokens={tokens} label={MESSAGES.ui.auth.forgotSubmitCode} onPress={() => void submit()} loading={loading} size='lg' />

          {submittedEmail ? (
            <Button
              tokens={tokens}
              label={MESSAGES.ui.auth.forgotHaveCode}
              onPress={() => safePush(`/reset-password?email=${encodeURIComponent(submittedEmail)}`)}
              variant='secondary'
              size='lg'
            />
          ) : null}
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
