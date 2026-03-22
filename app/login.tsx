import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { MESSAGES } from '@/constants/messages';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, loginWithApi } from '@/services/authSession';
import { validateEmail, validateLogin } from '@/services/authValidation';
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
    const loginError = validateLogin(normalizedLogin);
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
      style={[styles.container, { backgroundColor: tokens.bg }]}
    >
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: tokens.textMuted }]}>UNQX</Text>
        <Text style={[styles.title, { color: tokens.text }]}>{MESSAGES.ui.auth.loginTitle}</Text>
        <Text style={[styles.subtitle, { color: tokens.textSub }]}>{MESSAGES.ui.auth.loginSubtitle}</Text>

        <View style={styles.form}>
          <TextInput
            value={login}
            onChangeText={setLogin}
            placeholder={MESSAGES.ui.auth.loginPlaceholder}
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

          <Pressable
            onPress={() => void submit()}
            disabled={loading}
            style={[
              styles.submit,
              { backgroundColor: tokens.accent, opacity: loading ? 0.5 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={tokens.accentText} />
            ) : (
              <Text style={[styles.submitText, { color: tokens.accentText }]}>{MESSAGES.ui.auth.loginSubmit}</Text>
            )}
          </Pressable>

          {verificationEmail ? (
            <Pressable style={[styles.secondary, { borderColor: tokens.border }]} onPress={() => safePush(`/verify-email?email=${encodeURIComponent(verificationEmail)}`)}>
              <Text style={[styles.secondaryText, { color: tokens.text }]}>{MESSAGES.ui.auth.loginVerifyEmail}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.loginNoAccount}</Text>
          <Pressable onPress={() => safePush('/register')}>
            <Text style={[styles.footerLink, { color: tokens.text }]}>{MESSAGES.ui.auth.registerTitle}</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.loginForgotPassword}</Text>
          <Pressable onPress={() => safePush('/forgot-password')}>
            <Text style={[styles.footerLink, { color: tokens.text }]}>{MESSAGES.ui.auth.loginForgotPasswordAction}</Text>
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
    fontSize: 40,
    lineHeight: 40,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  form: {
    marginTop: 26,
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
  passwordWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 12,
    paddingRight: 8,
  },
  eyeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
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
    marginTop: 12,
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
