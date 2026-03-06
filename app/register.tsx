import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { MESSAGES } from '@/constants/messages';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, registerWithApi } from '@/services/authSession';
import { validateConfirmPassword, validateEmail, validateFirstName, validatePassword } from '@/services/authValidation';
import { useThemeContext } from '@/theme/ThemeProvider';

export default function RegisterPage(): React.JSX.Element {
  const { safePush, safeReplace } = useThrottledNavigation();
  const { tokens } = useThemeContext();
  const { ready, signedIn } = useAuthStatus();

  const [firstName, setFirstName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = React.useState<string>('');

  const submit = React.useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = firstName.trim();
    const validations = [
      validateFirstName(normalizedName),
      validateEmail(normalizedEmail),
      validatePassword(password),
      validateConfirmPassword(password, confirmPassword),
    ];
    const firstError = validations.find((message) => Boolean(message));
    if (firstError) {
      setInfo(null);
      setError(firstError);
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    setVerifyEmail('');
    try {
      const result = await registerWithApi({
        firstName: normalizedName,
        email: normalizedEmail,
        password,
        confirmPassword,
      });

      if (result.signedIn) {
        safeReplace('/(tabs)/home');
        return;
      }

      setInfo(result.message ?? MESSAGES.auth.registerDoneVerify);
      setVerifyEmail(result.email ?? normalizedEmail);
    } catch (e) {
      if (e instanceof AuthSessionError) {
        setError(e.message);
        return;
      }
      setError(e instanceof Error ? e.message : MESSAGES.auth.registerError);
    } finally {
      setLoading(false);
    }
  }, [confirmPassword, email, firstName, password, safeReplace]);

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
        <Text style={[styles.title, { color: tokens.text }]}>{MESSAGES.ui.auth.registerTitle}</Text>
        <Text style={[styles.subtitle, { color: tokens.textSub }]}>{MESSAGES.ui.auth.registerSubtitle}</Text>

        <View style={styles.form}>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder='Имя'
            placeholderTextColor={tokens.textMuted}
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text },
            ]}
          />

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

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder='Пароль'
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
            placeholder='Повтор пароля'
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
            style={[
              styles.submit,
              { backgroundColor: tokens.accent, opacity: loading ? 0.5 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={tokens.accentText} />
            ) : (
              <Text style={[styles.submitText, { color: tokens.accentText }]}>Создать аккаунт</Text>
            )}
          </Pressable>

          {verifyEmail ? (
            <Pressable style={[styles.secondary, { borderColor: tokens.border }]} onPress={() => safePush(`/verify-email?email=${encodeURIComponent(verifyEmail)}`)}>
              <Text style={[styles.secondaryText, { color: tokens.text }]}>Подтвердить email</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: tokens.textMuted }]}>Уже есть аккаунт?</Text>
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
