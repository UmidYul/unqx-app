import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { ChevronDown, Eye, EyeOff } from 'lucide-react-native';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { MESSAGES } from '@/constants/messages';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { AuthSessionError, checkRegistrationAvailability, registerWithApi } from '@/services/authSession';
import { validateCity, validateConfirmPassword, validateEmail, validateFirstName, validateLogin, validatePassword } from '@/services/authValidation';
import { useThemeContext } from '@/theme/ThemeProvider';
import { toUserErrorMessage } from '@/utils/errorMessages';

const CITY_OPTIONS = [
  'Ташкент',
  'Нукус',
  'Андижан',
  'Бухара',
  'Фергана',
  'Джизак',
  'Наманган',
  'Навои',
  'Карши',
  'Самарканд',
  'Гулистан',
  'Термез',
  'Ургенч',
  'Нурафшан',
] as const;

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

interface FieldAvailabilityState {
  status: AvailabilityStatus;
  message: string | null;
}

function getAvailabilityColor(status: AvailabilityStatus, tokens: ReturnType<typeof useThemeContext>['tokens']): string {
  if (status === 'available') return tokens.green;
  if (status === 'checking' || status === 'idle') return tokens.textMuted;
  return tokens.red;
}

export default function RegisterPage(): React.JSX.Element {
  const { safePush, safeReplace } = useThrottledNavigation();
  const { tokens } = useThemeContext();
  const { ready, signedIn } = useAuthStatus();
  const { language } = useLanguageContext();
  const isUz = language === 'uz';

  const [firstName, setFirstName] = React.useState('');
  const [city, setCity] = React.useState('');
  const [login, setLogin] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [cityPickerVisible, setCityPickerVisible] = React.useState(false);
  const [availabilitySupported, setAvailabilitySupported] = React.useState(true);
  const [loginAvailability, setLoginAvailability] = React.useState<FieldAvailabilityState>({ status: 'idle', message: null });
  const [emailAvailability, setEmailAvailability] = React.useState<FieldAvailabilityState>({ status: 'idle', message: null });
  const [loading, setLoading] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = React.useState<string>('');
  const availabilityRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    const normalizedLogin = login.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const loginFormatError = normalizedLogin ? validateLogin(normalizedLogin) : null;
    const emailFormatError = normalizedEmail ? validateEmail(normalizedEmail) : null;

    const canCheckLogin = availabilitySupported && Boolean(normalizedLogin && !loginFormatError);
    const canCheckEmail = availabilitySupported && Boolean(normalizedEmail && !emailFormatError);
    const requestId = availabilityRequestIdRef.current + 1;
    availabilityRequestIdRef.current = requestId;

    setLoginAvailability(
      !normalizedLogin
        ? { status: 'idle', message: null }
        : loginFormatError
          ? { status: 'invalid', message: loginFormatError }
          : canCheckLogin
            ? { status: 'checking', message: isUz ? 'Login tekshirilmoqda...' : 'Проверяем логин...' }
            : { status: 'idle', message: null },
    );

    setEmailAvailability(
      !normalizedEmail
        ? { status: 'idle', message: null }
        : emailFormatError
          ? { status: 'invalid', message: emailFormatError }
          : canCheckEmail
            ? { status: 'checking', message: isUz ? 'Email tekshirilmoqda...' : 'Проверяем email...' }
            : { status: 'idle', message: null },
    );

    if (!canCheckLogin && !canCheckEmail) {
      return undefined;
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await checkRegistrationAvailability({
            login: canCheckLogin ? normalizedLogin : undefined,
            email: canCheckEmail ? normalizedEmail : undefined,
          });

          if (availabilityRequestIdRef.current !== requestId) {
            return;
          }

          if (!result.supported) {
            setAvailabilitySupported(false);
            if (canCheckLogin) {
              setLoginAvailability({ status: 'idle', message: null });
            }
            if (canCheckEmail) {
              setEmailAvailability({ status: 'idle', message: null });
            }
            return;
          }

          if (canCheckLogin) {
            const check = result.login;
            if (!check.valid) {
              setLoginAvailability({ status: 'invalid', message: check.message || loginFormatError || MESSAGES.validation.loginInvalid });
            } else if (!check.available) {
              setLoginAvailability({ status: 'taken', message: check.message || (isUz ? 'Bu login band' : 'Этот логин уже занят') });
            } else {
              setLoginAvailability({ status: 'available', message: isUz ? 'Login bo‘sh' : 'Логин свободен' });
            }
          }

          if (canCheckEmail) {
            const check = result.email;
            if (!check.valid) {
              setEmailAvailability({ status: 'invalid', message: check.message || emailFormatError || MESSAGES.validation.emailInvalid });
            } else if (!check.available) {
              setEmailAvailability({ status: 'taken', message: check.message || (isUz ? 'Bu email band' : 'Этот email уже занят') });
            } else {
              setEmailAvailability({ status: 'available', message: isUz ? 'Email bo‘sh' : 'Email свободен' });
            }
          }
        } catch (checkError) {
          if (availabilityRequestIdRef.current !== requestId) {
            return;
          }
          const fallbackMessage = isUz ? 'Tekshirib bo‘lmadi' : 'Не удалось проверить';
          const message = toUserErrorMessage(checkError, fallbackMessage);
          if (canCheckLogin) {
            setLoginAvailability({ status: 'error', message });
          }
          if (canCheckEmail) {
            setEmailAvailability({ status: 'error', message });
          }
        }
      })();
    }, 450);

    return () => {
      clearTimeout(timer);
    };
  }, [availabilitySupported, email, isUz, login]);

  const submit = React.useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = firstName.trim();
    const normalizedCity = city.trim();
    const normalizedLogin = login.trim();
    const optionalEmailError = normalizedEmail ? validateEmail(normalizedEmail) : null;
    const validations = [
      validateFirstName(normalizedName),
      validateCity(normalizedCity),
      validateLogin(normalizedLogin),
      optionalEmailError,
      validatePassword(password),
      validateConfirmPassword(password, confirmPassword),
    ];
    const firstError = validations.find((message) => Boolean(message));
    if (firstError) {
      setInfo(null);
      setError(firstError);
      return;
    }

    if (loginAvailability.status === 'checking' || emailAvailability.status === 'checking') {
      setInfo(null);
      setError(isUz ? 'Login va email tekshiruvini kuting' : 'Дождитесь проверки логина и email');
      return;
    }

    if (loginAvailability.status === 'taken' || loginAvailability.status === 'invalid') {
      setInfo(null);
      setError(loginAvailability.message ?? (isUz ? 'Bu login band' : 'Этот логин уже занят'));
      return;
    }

    if (normalizedEmail && (emailAvailability.status === 'taken' || emailAvailability.status === 'invalid')) {
      setInfo(null);
      setError(emailAvailability.message ?? (isUz ? 'Bu email band' : 'Этот email уже занят'));
      return;
    }

    if (!agreed) {
      setInfo(null);
      setError(isUz
        ? "Ro'yxatdan o'tishdan oldin Foydalanish shartlari va Maxfiylik siyosatini qabul qiling"
        : 'Перед регистрацией примите Пользовательское соглашение и Политику конфиденциальности');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    setVerifyEmail('');
    try {
      const result = await registerWithApi({
        firstName: normalizedName,
        city: normalizedCity,
        login: normalizedLogin,
        email: normalizedEmail || null,
        password,
        confirmPassword,
      });

      if (result.signedIn) {
        safeReplace('/(tabs)/home');
        return;
      }

      const nextVerifyEmail = String(result.email ?? normalizedEmail ?? '').trim().toLowerCase();
      setVerifyEmail(nextVerifyEmail);

      if (nextVerifyEmail) {
        safeReplace(`/verify-email?email=${encodeURIComponent(nextVerifyEmail)}`);
        return;
      }

      safeReplace('/(tabs)/home');
    } catch (e) {
      if (e instanceof AuthSessionError) {
        setError(toUserErrorMessage(e, MESSAGES.auth.registerError));
        return;
      }
      setError(toUserErrorMessage(e, MESSAGES.auth.registerError));
    } finally {
      setLoading(false);
    }
  }, [agreed, city, confirmPassword, email, emailAvailability, firstName, isUz, login, loginAvailability, password, safeReplace]);

  if (!ready) {
    return <AuthLoadingScreen tokens={tokens} title={MESSAGES.ui.auth.sessionChecking} />;
  }

  if (signedIn) {
    return <Redirect href='/(tabs)/home' />;
  }

  const checkingAvailability = loginAvailability.status === 'checking' || emailAvailability.status === 'checking';

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
            placeholder={MESSAGES.ui.auth.namePlaceholder}
            placeholderTextColor={tokens.textMuted}
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text },
            ]}
          />

          <Pressable
            onPress={() => setCityPickerVisible(true)}
            accessibilityRole='button'
            accessibilityLabel={isUz ? 'Shahar tanlash' : 'Выбрать город'}
            style={[
              styles.selectTrigger,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border },
            ]}
          >
            <Text style={[styles.selectText, { color: city ? tokens.text : tokens.textMuted }]}>
              {city || MESSAGES.ui.auth.cityPlaceholder}
            </Text>
            <ChevronDown size={18} strokeWidth={1.6} color={tokens.textMuted} />
          </Pressable>

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
          {loginAvailability.status !== 'idle' && loginAvailability.message ? (
            <Text style={[styles.fieldHint, { color: getAvailabilityColor(loginAvailability.status, tokens) }]}>
              {loginAvailability.message}
            </Text>
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={MESSAGES.ui.auth.emailOptionalPlaceholder}
            placeholderTextColor={tokens.textMuted}
            autoCapitalize='none'
            keyboardType='email-address'
            autoCorrect={false}
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text },
            ]}
          />
          {emailAvailability.status !== 'idle' && emailAvailability.message ? (
            <Text style={[styles.fieldHint, { color: getAvailabilityColor(emailAvailability.status, tokens) }]}>
              {emailAvailability.message}
            </Text>
          ) : null}

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

          <View style={[styles.passwordWrap, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={MESSAGES.ui.auth.passwordConfirmPlaceholder}
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

          <Pressable
            onPress={() => setAgreed((prev) => !prev)}
            style={styles.consentRow}
            accessibilityRole='checkbox'
            accessibilityState={{ checked: agreed }}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: agreed ? tokens.accent : tokens.border,
                  backgroundColor: agreed ? tokens.accent : 'transparent',
                },
              ]}
            >
              {agreed ? <Text style={[styles.checkboxMark, { color: tokens.accentText }]}>✓</Text> : null}
            </View>
            <Text style={[styles.consentText, { color: tokens.textMuted }]}>
              {isUz ? 'Men ' : 'Я принимаю '}
              <Text
                style={[styles.consentLink, { color: tokens.text }]}
                onPress={() => {
                  void Linking.openURL('https://unqx.uz/terms');
                }}
              >
                {isUz ? 'Foydalanuvchi shartlari' : 'Пользовательское соглашение'}
              </Text>
              {isUz ? ' va ' : ' и '}
              <Text
                style={[styles.consentLink, { color: tokens.text }]}
                onPress={() => {
                  void Linking.openURL('https://unqx.uz/privacy');
                }}
              >
                {isUz ? 'Maxfiylik siyosati' : 'Политику конфиденциальности'}
              </Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void submit()}
            disabled={loading || !agreed || checkingAvailability}
            style={[
              styles.submit,
              { backgroundColor: tokens.accent, opacity: loading || !agreed || checkingAvailability ? 0.5 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={tokens.accentText} />
            ) : (
              <Text style={[styles.submitText, { color: tokens.accentText }]}>{MESSAGES.ui.auth.registerSubmit}</Text>
            )}
          </Pressable>

          {verifyEmail ? (
            <Pressable style={[styles.secondary, { borderColor: tokens.border }]} onPress={() => safePush(`/verify-email?email=${encodeURIComponent(verifyEmail)}`)}>
              <Text style={[styles.secondaryText, { color: tokens.text }]}>{MESSAGES.ui.auth.registerVerifyEmail}</Text>
            </Pressable>
          ) : null}
        </View>

        <Modal
          visible={cityPickerVisible}
          transparent
          animationType='fade'
          onRequestClose={() => setCityPickerVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setCityPickerVisible(false)}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: tokens.bg, borderColor: tokens.border }]}
              onPress={(event) => event.stopPropagation()}
            >
              <Text style={[styles.modalTitle, { color: tokens.text }]}>
                {isUz ? 'Shaharni tanlang' : 'Выберите город'}
              </Text>
              <ScrollView
                style={styles.cityList}
                contentContainerStyle={styles.cityListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps='handled'
              >
                {CITY_OPTIONS.map((option) => {
                  const selected = city === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setCity(option);
                        setCityPickerVisible(false);
                      }}
                      style={[
                        styles.cityOption,
                        {
                          borderColor: selected ? tokens.accent : tokens.border,
                          backgroundColor: selected ? `${tokens.accent}14` : tokens.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.cityOptionText, { color: selected ? tokens.accent : tokens.text }]}>
                        {option}
                      </Text>
                      {selected ? <Text style={[styles.cityOptionCheck, { color: tokens.accent }]}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: tokens.textMuted }]}>{MESSAGES.ui.auth.registerHasAccount}</Text>
          <Pressable onPress={() => safePush('/login')}>
            <Text style={[styles.footerLink, { color: tokens.text }]}>{MESSAGES.ui.auth.registerHasAccountAction}</Text>
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
  selectTrigger: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  fieldHint: {
    marginTop: -3,
    marginBottom: 1,
    paddingHorizontal: 2,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
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
  info: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  consentRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    marginTop: 2,
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: {
    fontSize: 12,
    lineHeight: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  consentLink: {
    textDecorationLine: 'underline',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  modalTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  cityList: {
    flexGrow: 0,
  },
  cityListContent: {
    gap: 8,
  },
  cityOption: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cityOptionText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  cityOptionCheck: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
