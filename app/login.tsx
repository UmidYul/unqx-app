import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { Button } from '@/components/ui/Button';
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { MESSAGES } from '@/constants/messages';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, loginWithApi } from '@/services/authSession';
import { validateEmail, validateLoginOrEmail } from '@/services/authValidation';
import { useThemeContext } from '@/theme/ThemeProvider';
import { toUserErrorMessage } from '@/utils/errorMessages';

export default function LoginPage(): React.JSX.Element {
  const { safePush, safeReplace } = useThrottledNavigation();
  const { tokens } = useThemeContext();
  const { ready, signedIn } = useAuthStatus();

  const [login, setLogin] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = React.useState<string>('');

  const submit = React.useCallback(async () => {
    const normalizedLogin = login.trim();
    const loginError = validateLoginOrEmail(normalizedLogin);
    if (loginError) {
      setError(loginError);
      return;
    }
    if (!password) {
      setError(MESSAGES.validation.passwordRequired);
      return;
    }

    setLoading(true);
    setError(null);
    setVerificationEmail('');
    try {
      const result = await loginWithApi(normalizedLogin, password);
      if (result.requiresVerification) {
        setError(result.message ?? MESSAGES.auth.unverifiedEmail);
        let emailForVerification = typeof result.email === 'string' ? result.email.trim().toLowerCase() : '';
        if (!emailForVerification && validateEmail(normalizedLogin) === null) {
          emailForVerification = normalizedLogin.toLowerCase();
        }
        setVerificationEmail(emailForVerification);
        return;
      }
      safeReplace('/(tabs)/home');
    } catch (e) {
      if (e instanceof AuthSessionError) {
        setError(toUserErrorMessage(e, MESSAGES.auth.loginError));
        return;
      }
      setError(toUserErrorMessage(e, MESSAGES.auth.loginError));
    } finally {
      setLoading(false);
    }
  }, [login, password, safeReplace]);

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
        eyebrow='UNQX / Login'
        title={MESSAGES.ui.auth.loginTitle}
        subtitle={MESSAGES.ui.auth.loginSubtitle}
        topAction={{ label: 'Назад к NFC', onPress: () => safeReplace('/(tabs)/nfc') }}
        footer={(
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.loginForgotPassword}</Text>
            <Pressable onPress={() => safePush('/forgot-password')}>
              <Text style={[styles.footerLink, { color: tokens.text }]}>{MESSAGES.ui.auth.loginForgotPasswordAction}</Text>
            </Pressable>
          </View>
        )}
      >
        <View style={styles.form}>
          <TextInput
            value={login}
            onChangeText={setLogin}
            placeholder={MESSAGES.ui.auth.loginOrEmailPlaceholder}
            placeholderTextColor={tokens.textMuted}
            autoCapitalize='none'
            autoCorrect={false}
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text },
            ]}
          />

          <View style={[styles.passwordWrap, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={MESSAGES.ui.auth.passwordPlaceholder}
              placeholderTextColor={tokens.textMuted}
              secureTextEntry={!showPassword}
              style={[styles.passwordInput, { color: tokens.text }]}
            />
            <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeBtn}>
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.5} color={tokens.textMuted} />
              ) : (
                <Eye size={18} strokeWidth={1.5} color={tokens.textMuted} />
              )}
            </Pressable>
          </View>

          {error ? <Text style={[styles.error, { color: tokens.red }]}>{error}</Text> : null}

          <Button tokens={tokens} label={MESSAGES.ui.auth.loginSubmit} onPress={() => void submit()} loading={loading} size='lg' />

          {verificationEmail ? (
            <Button
              tokens={tokens}
              label={MESSAGES.ui.auth.loginVerifyEmail}
              onPress={() => safePush(`/verify-email?email=${encodeURIComponent(verificationEmail)}`)}
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
  passwordWrap: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 12,
    paddingRight: 8,
  },
  eyeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
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
