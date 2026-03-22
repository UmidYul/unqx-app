import { MESSAGES } from '@/constants/messages';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,58}[A-Za-z0-9]$/;
const PASSWORD_HAS_LETTER_RE = /[A-Za-z]/;
const PASSWORD_HAS_DIGIT_RE = /\d/;
const OTP_RE = /^\d{6}$/;

export function validateEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email) {
    return MESSAGES.validation.emailRequired;
  }
  if (!EMAIL_RE.test(email)) {
    return MESSAGES.validation.emailInvalid;
  }
  return null;
}

export function validateFirstName(value: string): string | null {
  const name = value.trim();
  if (!name) {
    return MESSAGES.validation.nameRequired;
  }
  if (name.length < 2) {
    return MESSAGES.validation.nameTooShort;
  }
  if (name.length > 50) {
    return MESSAGES.validation.nameTooLong;
  }
  return null;
}

export function validateCity(value: string): string | null {
  const city = value.trim();
  if (!city) {
    return MESSAGES.validation.cityRequired;
  }
  return null;
}

export function validateLogin(value: string): string | null {
  const login = value.trim();
  if (!login) {
    return MESSAGES.validation.loginRequired;
  }
  if (!LOGIN_RE.test(login)) {
    return MESSAGES.validation.loginInvalid;
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) {
    return MESSAGES.validation.passwordRequired;
  }
  if (value.length < 8) {
    return MESSAGES.validation.passwordMin;
  }
  if (!PASSWORD_HAS_LETTER_RE.test(value) || !PASSWORD_HAS_DIGIT_RE.test(value)) {
    return MESSAGES.validation.passwordRules;
  }
  return null;
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) {
    return MESSAGES.validation.confirmRequired;
  }
  if (password !== confirmPassword) {
    return MESSAGES.validation.passwordMismatch;
  }
  return null;
}

export function validateOtpCode(value: string): string | null {
  const code = value.replace(/\D/g, '');
  if (!code) {
    return MESSAGES.validation.otpRequired;
  }
  if (!OTP_RE.test(code)) {
    return MESSAGES.validation.otpInvalid;
  }
  return null;
}
