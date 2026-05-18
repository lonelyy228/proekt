type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL_PROVIDER_ERROR"
  | "INTERNAL_ERROR";

const localizedByCode: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Некорректные данные запроса",
  AUTH_ERROR: "Ошибка авторизации",
  FORBIDDEN: "Недостаточно прав для выполнения операции",
  NOT_FOUND: "Запрошенный ресурс не найден",
  CONFLICT: "Конфликт данных",
  RATE_LIMITED: "Слишком много запросов, попробуйте позже",
  EXTERNAL_PROVIDER_ERROR: "Ошибка внешнего сервиса",
  INTERNAL_ERROR: "Внутренняя ошибка сервера"
};

const localizedByMessage: Record<string, string> = {
  "Email already exists": "Пользователь с таким email уже существует",
  "Invalid credentials": "Неверный email или пароль",
  "Two-factor code required": "Требуется код двухфакторной аутентификации",
  "Two-factor not configured": "Двухфакторная аутентификация не настроена",
  "Invalid two-factor code": "Неверный код двухфакторной аутентификации",
  "Refresh token does not exist": "Сессия не найдена, выполните вход снова",
  "Refresh token reuse detected": "Обнаружено повторное использование токена, выполните вход снова",
  "Refresh token expired": "Срок действия сессии истек, выполните вход снова",
  "Invalid refresh token subject": "Некорректная сессия, выполните вход снова",
  "User not found": "Пользователь не найден",
  "Two-factor setup not found": "Настройка двухфакторной аутентификации не найдена",
  "Invalid TOTP code": "Неверный код подтверждения",
  "2FA is not enabled": "Двухфакторная аутентификация не включена",
  "Invalid 2FA code": "Неверный код двухфакторной аутентификации",
  "Missing CSRF token": "Отсутствует CSRF-токен",
  "Invalid CSRF token": "Недействительный CSRF-токен",
  "Invalid CSRF token signature": "Недействительная подпись CSRF-токена",
  "Quantity must be greater than zero": "Количество должно быть больше нуля",
  "Cart is empty": "Корзина пуста",
  "Unsupported image file type": "Неподдерживаемый тип файла изображения",
  "Image file exceeds maximum size": "Размер изображения превышает допустимый лимит",
  "Too many requests": "Слишком много запросов, попробуйте позже",
  "Insufficient permissions": "Недостаточно прав для выполнения операции",
  "Authentication required": "Требуется авторизация",
  "Session is not active": "Сессия неактивна, выполните вход снова",
  "Invalid access token": "Недействительный токен доступа",
  "Invalid refresh token": "Недействительный refresh-токен",
  "itemId is required": "Не указан идентификатор позиции корзины",
  "Missing refresh token": "Отсутствует refresh-токен"
};

export const localizeAppErrorMessage = (code: ErrorCode, message: string): string =>
  localizedByMessage[message] ?? localizedByCode[code] ?? message;

export const localizeErrorCodeMessage = (code: ErrorCode): string => localizedByCode[code];
