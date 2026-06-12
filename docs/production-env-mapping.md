# Production Env Mapping For RSH

Этот документ нужен для быстрого заполнения production-переменных перед выкладкой RSH на Vercel.

## 1. Базовые переменные приложения

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `NODE_ENV` | `production` | Указать вручную |
| `APP_URL` | `https://your-domain.ru` | Домен проекта в Vercel |
| `COOKIE_DOMAIN` | `your-domain.ru` | Основной домен без `https://` и без порта |

Важно:

- `APP_URL` должен быть `https`, без `localhost`.
- `COOKIE_DOMAIN` не должен содержать `http`, `https` и номер порта.

## 2. PostgreSQL / Neon

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `DATABASE_URL` | pooled connection string | Neon -> Dashboard -> Connection Details |
| `DIRECT_URL` | direct connection string | Neon -> Dashboard -> Connection Details |

Рекомендации:

- `DATABASE_URL` использовать как основной URL Prisma.
- `DIRECT_URL` использовать для миграций и административных операций.
- После заполнения обязательно выполнить `npm run prisma:deploy`.

## 3. Redis / Upstash

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `REDIS_URL` | `rediss://...` | Upstash Redis -> REST / TCP connection string |

Рекомендации:

- Для production использовать именно TLS-вариант `rediss://`.
- После подключения проверить rate limiting и session-related flows.

## 4. JWT и auth secrets

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | длинный случайный секрет | Сгенерировать вручную |
| `JWT_REFRESH_SECRET` | другой длинный случайный секрет | Сгенерировать вручную |
| `JWT_KEY_ID` | версия активного ключа, например `prod-key-1` | Указать вручную |
| `REFRESH_TOKEN_PEPPER` | отдельная секретная строка | Сгенерировать вручную |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Указать вручную |
| `REFRESH_TOKEN_TTL_DAYS` | `14` | Указать вручную |

Важно:

- `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` должны быть разными.
- Не копировать тестовые значения в production.
- Хранить реальные значения только в Vercel Environment Variables.

## 5. Stripe

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe Dashboard -> Developers -> API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe Dashboard -> Developers -> Webhooks |
| `STRIPE_PRICE_CURRENCY` | `rub` | Указать вручную |

Важно:

- Для production должен использоваться именно `sk_live_...`.
- После деплоя нужно создать webhook endpoint на `/api/webhooks/stripe`.
- После создания webhook обязательно подставить production `whsec_...`.

## 6. UploadThing

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `UPLOADTHING_TOKEN` | production token | UploadThing Dashboard |
| `UPLOADTHING_APP_ID` | app id | UploadThing Dashboard |

Важно:

- Эти переменные обязательны для production-редактора.
- Без них загрузка файлов и превью кастомных дизайнов работать не будет.

## 7. Магазин и курсовая логика

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `STORE_USD_TO_RUB_RATE` | например `90` | Указать вручную |

Примечание:

- Сейчас проект работает в рублях, поэтому это значение используется как техническая подстраховка для пересчёта legacy-данных.

## 8. Monitoring

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `SENTRY_DSN` | DSN проекта | Sentry Project Settings |
| `SENTRY_ERROR_SAMPLE_RATE` | например `1` | Указать вручную |
| `SENTRY_WARNING_SAMPLE_RATE` | например `0.35` | Указать вручную |
| `SENTRY_INFO_SAMPLE_RATE` | например `0.05` | Указать вручную |

Примечание:

- `SENTRY_DSN` не является жёстко обязательной для старта, но для публичного запуска крайне рекомендуется.

## 9. Что сделать после заполнения env

В корне проекта выполнить:

```powershell
npm run deploy:env-check -- .env.production.example
npm run prisma:generate
npm run prisma:deploy
npm run build
```

Если всё проходит локально, можно запускать production deploy в Vercel.

## 10. Быстрая последовательность запуска

1. Создать проект в Vercel и подключить GitHub-репозиторий.
2. Создать базу в Neon.
3. Создать Redis в Upstash.
4. Создать приложение в UploadThing.
5. Создать production keys в Stripe.
6. Заполнить все env в Vercel.
7. Выполнить миграции Prisma.
8. Сделать первый deploy.
9. Проверить логин, каталог, корзину, checkout, профиль, админку и 2D Lab.
