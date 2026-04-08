import { MESSAGES, getMessagesLanguage } from '@/constants/messages';
import { ApiError } from '@/lib/apiClient';

const FALLBACK_RU = 'Произошла ошибка. Попробуйте ещё раз';
const FALLBACK_UZ = "Xatolik yuz berdi. Qayta urinib ko'ring";
const NETWORK_RU = 'Нет соединения. Проверьте интернет и попробуйте снова';
const NETWORK_UZ = "Internet ulanmagan. Ulanishni tekshirib qayta urinib ko'ring";
const SERVER_RU = 'Сервис временно недоступен. Попробуйте позже';
const SERVER_UZ = 'Xizmat vaqtincha ishlamayapti. Keyinroq urinib ko‘ring';
const NFC_RU = 'Ошибка NFC. Повторите попытку';
const NFC_UZ = "NFC xatosi. Qayta urinib ko'ring";
const NFC_PROTECTED_RU = 'Метка защищена. Запись невозможна.';
const NFC_PROTECTED_UZ = "Teg himoyalangan. Unga yozib bo'lmaydi.";

const TECHNICAL_MESSAGE_PATTERNS: RegExp[] = [
  /\b(typeerror|referenceerror|syntaxerror|rangeerror|axioserror)\b/i,
  /\b(exception|stack trace)\b/i,
  /\b(econn\w*|enotfound|eai_again|etimedout|enoent|eacces)\b/i,
  /\brequest to .* failed\b/i,
  /\bjson\.parse|unexpected token\b/i,
  /\b(status|http)\s*[:=]?\s*(4\d{2}|5\d{2})\b/i,
  /https?:\/\/\S+/i,
];

const API_CODE_MESSAGES: Record<string, { ru: string; uz: string }> = {
  RATE_LIMITED: {
    ru: 'Слишком много попыток. Подождите немного и повторите',
    uz: "Juda ko'p urinish bo'ldi. Biroz kutib, qayta urinib ko'ring",
  },
  PLAN_REQUIRED: {
    ru: 'Тариф не активирован. Подключите тариф и повторите',
    uz: 'Tarif faollashtirilmagan. Tarifni yoqib qayta urinib ko‘ring',
  },
  UPGRADE_REQUIRED: {
    ru: 'Эта функция доступна только в Премиум тарифе',
    uz: 'Bu funksiya faqat Premium tarifida mavjud',
  },
  ACCOUNT_DISABLED: {
    ru: 'Аккаунт отключен. Обратитесь в поддержку',
    uz: "Akkaunt o'chirilgan. Qo'llab-quvvatlash xizmatiga murojaat qiling",
  },
  ACCOUNT_DELETED: {
    ru: 'Аккаунт удалён. Зарегистрируйтесь заново',
    uz: "Akkaunt o'chirilgan. Qayta ro'yxatdan o'ting",
  },
  ACCOUNT_DEACTIVATED: {
    ru: 'Аккаунт деактивирован. Восстановите его через email',
    uz: 'Akkaunt faolsiz. Uni email orqali tiklang',
  },
  USERS_STORAGE_UNAVAILABLE: {
    ru: 'Сервис временно недоступен. Попробуйте позже',
    uz: 'Xizmat vaqtincha ishlamayapti. Keyinroq urinib ko‘ring',
  },
  NO_PATH: {
    ru: SERVER_RU,
    uz: SERVER_UZ,
  },
  NFC_WRITE_FAILED: {
    ru: NFC_RU,
    uz: NFC_UZ,
  },
  NFC_TAG_DELETE_FAILED: {
    ru: 'Не удалось удалить метку. Повторите попытку',
    uz: "Tegni o'chirib bo'lmadi. Qayta urinib ko'ring",
  },
  NFC_TAG_DELETE_NOT_CONFIRMED: {
    ru: 'Метка пока не подтвердила удаление. Обновите список и попробуйте снова',
    uz: "Teg o'chirilgani tasdiqlanmadi. Ro'yxatni yangilab, qayta urinib ko'ring",
  },
};

function currentLanguage(): 'ru' | 'uz' {
  return getMessagesLanguage() === 'uz' ? 'uz' : 'ru';
}

function byLanguage(ru: string, uz: string): string {
  return currentLanguage() === 'uz' ? uz : ru;
}

function fromApiCode(code: string | null): string | null {
  if (!code) {
    return null;
  }

  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const authCodeMessages = MESSAGES.auth.codeMessages as Record<string, string>;
  if (authCodeMessages[normalizedCode]) {
    return authCodeMessages[normalizedCode];
  }

  const mapped = API_CODE_MESSAGES[normalizedCode];
  if (!mapped) {
    return null;
  }

  return currentLanguage() === 'uz' ? mapped.uz : mapped.ru;
}

function fromStatus(status: number): string | null {
  if (status === 403) {
    return MESSAGES.auth.codeMessages.AUTH_REQUIRED;
  }
  if (status === 404) {
    return byLanguage('Данные не найдены', "Ma'lumot topilmadi");
  }
  if (status === 408) {
    return byLanguage('Сервер отвечает слишком долго. Повторите попытку', 'Server javobi kechikdi. Qayta urinib ko‘ring');
  }
  if (status >= 500) {
    return byLanguage(SERVER_RU, SERVER_UZ);
  }
  return null;
}

function normalizeMessage(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function looksTechnicalMessage(message: string): boolean {
  if (TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  if (/^[A-Z0-9_]{3,64}$/.test(message)) {
    return true;
  }

  return false;
}

function fromRawMessage(raw: string): string | null {
  const message = normalizeMessage(raw);
  if (!message) {
    return null;
  }

  const lower = message.toLowerCase();
  if (
    lower.includes('network request failed')
    || lower.includes('failed to fetch')
    || lower.includes('networkerror')
    || lower.includes('econn')
    || lower.includes('enotfound')
    || lower.includes('timeout')
    || lower.includes('timed out')
  ) {
    return byLanguage(NETWORK_RU, NETWORK_UZ);
  }

  if (
    lower === 'request failed'
    || lower.includes('internal server error')
    || lower.includes('unexpected token')
    || lower.includes('json')
    || lower.includes('typeerror')
    || lower.includes('forbidden')
    || lower.includes('unauthorized')
    || lower.includes('no api path provided')
  ) {
    return byLanguage(FALLBACK_RU, FALLBACK_UZ);
  }

  if (
    lower.includes('nfc operation failed')
    || lower.includes('failed to encode nfc')
    || lower.includes('nfc write failed')
  ) {
    return byLanguage(NFC_RU, NFC_UZ);
  }

  if (lower.includes('nfc_tag_protected')) {
    return byLanguage(NFC_PROTECTED_RU, NFC_PROTECTED_UZ);
  }

  if (looksTechnicalMessage(message)) {
    return byLanguage(FALLBACK_RU, FALLBACK_UZ);
  }

  return message;
}

export function toUserErrorMessage(error: unknown, fallback?: string): string {
  const defaultMessage = fallback ?? byLanguage(FALLBACK_RU, FALLBACK_UZ);

  if (error instanceof ApiError) {
    const fromCode = fromApiCode(error.code);
    if (fromCode) {
      return fromCode;
    }

    const fromHttpStatus = fromStatus(error.status);
    if (fromHttpStatus) {
      return fromHttpStatus;
    }

    const fromMessage = fromRawMessage(error.message);
    return fromMessage ?? defaultMessage;
  }

  if (error instanceof Error) {
    const fromMessage = fromRawMessage(error.message);
    return fromMessage ?? defaultMessage;
  }

  if (typeof error === 'string') {
    const fromMessage = fromRawMessage(error);
    return fromMessage ?? defaultMessage;
  }

  return defaultMessage;
}
