const actionLabels: Record<string, string> = {
  AUTH_LOGIN: "Вход в систему",
  USER_ROLE_CHANGE: "Смена роли пользователя",
  USER_BLOCK: "Блокировка пользователя",
  USER_UNBLOCK: "Разблокировка пользователя",
  USER_BULK_UPDATE: "Массовое обновление пользователей",
  USER_EXPORT: "Экспорт пользователей",
  USER_FILTER_PRESET_CREATE: "Создание пресета пользователей",
  USER_FILTER_PRESET_UPDATE: "Обновление пресета пользователей",
  USER_FILTER_PRESET_DELETE: "Удаление пресета пользователей",
  PRODUCT_CREATE: "Создание товара",
  PRODUCT_UPDATE: "Обновление товара",
  PRODUCT_DELETE: "Удаление товара",
  PRODUCT_STATUS_BULK_UPDATE: "Массовая смена статуса товаров",
  PRODUCT_EXPORT: "Экспорт товаров",
  PRODUCT_FILTER_PRESET_CREATE: "Создание пресета товаров",
  PRODUCT_FILTER_PRESET_UPDATE: "Обновление пресета товаров",
  PRODUCT_FILTER_PRESET_DELETE: "Удаление пресета товаров",
  ORDER_STATUS_CHANGE: "Смена статуса заказа",
  ORDER_STATUS_CHANGE_BULK: "Массовая смена статуса заказов",
  ORDER_EXPORT: "Экспорт заказов",
  ORDER_FILTER_PRESET_CREATE: "Создание пресета заказов",
  ORDER_FILTER_PRESET_UPDATE: "Обновление пресета заказов",
  ORDER_FILTER_PRESET_DELETE: "Удаление пресета заказов",
  SESSION_REVOKE: "Отзыв сессии",
  SESSION_REVOKE_BULK: "Массовый отзыв сессий",
  SESSION_FILTER_PRESET_CREATE: "Создание пресета сессий",
  SESSION_FILTER_PRESET_UPDATE: "Обновление пресета сессий",
  SESSION_FILTER_PRESET_DELETE: "Удаление пресета сессий",
  WEBHOOK_REPLAY: "Повтор webhook-события",
  WEBHOOK_REPLAY_BULK: "Массовый повтор webhook-событий",
  WEBHOOK_EXPORT: "Экспорт webhook-событий",
  WEBHOOK_FILTER_PRESET_CREATE: "Создание пресета webhook",
  WEBHOOK_FILTER_PRESET_UPDATE: "Обновление пресета webhook",
  WEBHOOK_FILTER_PRESET_DELETE: "Удаление пресета webhook",
  CONTENT_CREATE: "Создание публикации",
  CONTENT_UPDATE: "Обновление публикации",
  CONTENT_STATUS_BULK_UPDATE: "Массовая смена статуса публикаций",
  CONTENT_FILTER_PRESET_CREATE: "Создание пресета контента",
  CONTENT_FILTER_PRESET_UPDATE: "Обновление пресета контента",
  CONTENT_FILTER_PRESET_DELETE: "Удаление пресета контента",
  ADMIN_LOG_FILTER_PRESET_CREATE: "Создание пресета логов",
  ADMIN_LOG_FILTER_PRESET_UPDATE: "Обновление пресета логов",
  ADMIN_LOG_FILTER_PRESET_DELETE: "Удаление пресета логов"
};

const targetTypeLabels: Record<string, string> = {
  USER: "Пользователь",
  PRODUCT: "Товар",
  ORDER: "Заказ",
  SESSION: "Сессия",
  STRIPE_EVENT: "Stripe-событие",
  CONTENT_POST: "Публикация",
  USER_FILTER_PRESET: "Пресет фильтров пользователей",
  PRODUCT_FILTER_PRESET: "Пресет фильтров товаров",
  ORDER_FILTER_PRESET: "Пресет фильтров заказов",
  SESSION_FILTER_PRESET: "Пресет фильтров сессий",
  WEBHOOK_FILTER_PRESET: "Пресет фильтров webhook",
  CONTENT_FILTER_PRESET: "Пресет фильтров контента",
  ADMIN_LOG_FILTER_PRESET: "Пресет фильтров логов"
};

const toHumanReadable = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    return "-";
  }

  return normalized
    .split(/[_-]+/)
    .filter((item) => item.length > 0)
    .map((item) =>
      item.length <= 3
        ? item.toUpperCase()
        : `${item.charAt(0).toUpperCase()}${item.slice(1).toLowerCase()}`
    )
    .join(" ");
};

export const getAdminActionLabel = (action: string): string =>
  actionLabels[action] ?? toHumanReadable(action);

export const getAdminTargetTypeLabel = (targetType: string): string =>
  targetTypeLabels[targetType] ?? toHumanReadable(targetType);
