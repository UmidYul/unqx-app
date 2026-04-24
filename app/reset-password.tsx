import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { Button } from '@/components/ui/Button';
import { MESSAGES } from '@/constants/messages';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, resetPasswordWithApi } from '@/services/authSession';
import { validateConfirmPassword, validateEmail, validateOtpCode, validatePassword } from '@/services/authValidation';
import { useThemeContext } from '@/theme/ThemeProvider';
import { toUserErrorMessage } from '@/utils/errorMessages';

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
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
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
        setError(toUserErrorMessage(e, MESSAGES.auth.resetPasswordError));
        return;
      }
      setError(toUserErrorMessage(e, MESSAGES.auth.resetPasswordError));
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
      style={[styles.container, { backgroundColor: tokens.phoneBg }]}
    >
      <AuthScaffold
        tokens={tokens}
        eyebrow='UNQX / Reset Password'
        title={MESSAGES.ui.auth.resetPasswordTitle}
        subtitle={MESSAGES.ui.auth.resetPasswordSubtitle}
        topAction={{ label: 'Назад', onPress: () => safePush('/forgot-password') }}
        footer={(
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.resetNoCode}</Text>
            <Pressable onPress={() => safePush('/forgot-password')}>
              <Text style={[styles.footerLink, { color: tokens.text }]}>{MESSAGES.ui.auth.resetNoCodeAction}</Text>
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

          <OtpCodeInput value={code} onChange={setCode} tokens={tokens} disabled={loading || done} />

          <View style={[styles.passwordWrap, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={MESSAGES.ui.auth.newPasswordPlaceholder}
              placeholderTextColor={tokens.textMuted}
              secureTextEntry={!showNewPassword}
              style={[styles.passwordInput, { color: tokens.text }]}
            />
            <Pressable onPress={() => setShowNewPassword((prev) => !prev)} style={styles.eyeBtn}>
              {showNewPassword ? (
                <EyeOff size={18} strokeWidth={1.5} color={tokens.textMuted} />
              ) : (
                <Eye size={18} strokeWidth={1.5} color={tokens.textMuted} />
              )}
            </Pressable>
          </View>

          <View style={[styles.passwordWrap, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={MESSAGES.ui.auth.newPasswordConfirmPlaceholder}
              placeholderTextColor={tokens.textMuted}
              secureTextEntry={!showConfirmPassword}
              style={[styles.passwordInput, { color: tokens.text }]}
            />
            <Pressable onPress={() => setShowConfirmPassword((prev) => !prev)} style={styles.eyeBtn}>
              {showConfirmPassword ? (
                <EyeOff size={18} strokeWidth={1.5} color={tokens.textMuted} />
              ) : (
                <Eye size={18} strokeWidth={1.5} color={tokens.textMuted} />
              )}
            </Pressable>
          </View>

          {error ? <Text style={[styles.error, { color: tokens.red }]}>{error}</Text> : null}
          {info ? <Text style={[styles.info, { color: tokens.green }]}>{info}</Text> : null}

          <Button tokens={tokens} label={MESSAGES.ui.auth.resetSubmit} onPress={() => void submit()} loading={loading} size='lg' />

          {done ? (
            <Text style={[styles.redirectHint, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.resetRedirectHint}</Text>
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
  info: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  redirectHint: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
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
