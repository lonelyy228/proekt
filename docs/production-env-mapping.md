# Production Env Mapping For RSH

Этот документ описывает актуальное заполнение production-переменных для запуска RSH в инфраструктуре, которая нормально подходит под РФ.

Главная идея:

- приложение запускается не в `Vercel`, а на своем Linux server / VM;
- платежи идут через `CloudPayments`;
- база и Redis могут быть либо managed в РФ-облаке, либо локально на том же сервере;
- загрузки сейчас лучше запускать через `UPLOAD_PROVIDER=local`, потому что код уже стабилен в этом режиме.

Если нужен полный сценарий выкладки, см. [docs/russia-production-runbook.md](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/docs/russia-production-runbook.md).

## 1. Базовые переменные приложения

| Переменная | Что указывать | Пример |
| --- | --- | --- |
| `NODE_ENV` | всегда `production` | `production` |
| `APP_URL` | публичный HTTPS-домен сайта | `https://rsh-store.ru` |
| `COOKIE_DOMAIN` | домен без `https://` и без порта | `rsh-store.ru` |

Важно:

- `APP_URL` должен быть на `https`;
- `COOKIE_DOMAIN` не должен содержать порт;
- `localhost` и `127.0.0.1` для production запрещены текущей валидацией проекта.

## 2. PostgreSQL

| Переменная | Что указывать | Откуда взять |
| --- | --- | --- |
| `DATABASE_URL` | основной PostgreSQL connection string | Managed PostgreSQL или локальный PostgreSQL |
| `DIRECT_URL` | direct connection string для Prisma migrations | тот же провайдер |

Пример:

```text
DATABASE_URL=postgresql://rsh_user:strong_password@10.0.0.12:6432/rsh?sslmode=require
DIRECT_URL=postgresql://rsh_user:strong_password@10.0.0.12:5432/rsh?sslmode=require
```

Рекомендации:

- если используешь managed PostgreSQL с pooler, `DATABASE_URL` лучше направить на pooler;
- `DIRECT_URL` лучше держать прямым к хосту БД;
- после заполнения обязательно выполнять `npm run prisma:deploy`.

## 3. Redis

| Переменная | Что указывать | Пример |
| --- | --- | --- |
| `REDIS_URL` | Redis URL | `rediss://default:password@redis-host:6379` |

Рекомендации:

- если провайдер дает TLS, используй `rediss://`;
- если Redis стоит в приватной сети между внутренними сервисами, допустим обычный `redis://`, если это реально ваш изолированный контур;
- после подключения нужно отдельно проверить rate limit и auth/session flows.

## 4. JWT и auth secrets

| Переменная | Что указывать |
| --- | --- |
| `JWT_ACCESS_SECRET` | длинный случайный секрет |
| `JWT_REFRESH_SECRET` | другой длинный случайный секрет |
| `JWT_KEY_ID` | версия активного ключа, например `rsh-prod-v1` |
| `REFRESH_TOKEN_PEPPER` | отдельная секретная строка |
| `ACCESS_TOKEN_TTL_SECONDS` | например `900` |
| `REFRESH_TOKEN_TTL_DAYS` | например `30` |

Важно:

- `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` должны быть разными;
- не использовать локальные demo-значения;
- хранить эти значения только в секретах панели хостинга, CI или secret manager.

## 5. Платежи

### Вариант для РФ: CloudPayments

| Переменная | Что указывать |
| --- | --- |
| `PAYMENT_PROVIDER` | `cloudpayments` |
| `CLOUDPAYMENTS_PUBLIC_ID` | Public ID из кабинета CloudPayments |
| `CLOUDPAYMENTS_API_SECRET` | API Secret из кабинета CloudPayments |
| `STRIPE_PRICE_CURRENCY` | `rub` |

Пример:

```text
PAYMENT_PROVIDER=cloudpayments
CLOUDPAYMENTS_PUBLIC_ID=pk_xxxxxxxxx
CLOUDPAYMENTS_API_SECRET=xxxxxxxxx
STRIPE_PRICE_CURRENCY=rub
```

Важно:

- webhook URLs должны смотреть на:
  - `/api/webhooks/cloudpayments/check`
  - `/api/webhooks/cloudpayments/pay`
  - `/api/webhooks/cloudpayments/fail`
- если запускаешь сайт без реального эквайринга, оставляй `PAYMENT_PROVIDER=manual`.

## 6. Uploads

### Текущий стабильный production-вариант

| Переменная | Что указывать |
| --- | --- |
| `UPLOAD_PROVIDER` | `local` |

Почему так:

- код уже поддерживает `local`;
- это самый быстрый и надежный запуск без дополнительной интеграции;
- для S3-совместимого хранилища понадобится отдельный кодовый провайдер, если захочешь увести assets из файловой системы VM.

Примечание:

- при `UPLOAD_PROVIDER=local` нужно настроить регулярные backup файловой директории;
- если позже перейдем на S3, env mapping можно будет расширить.

## 7. Магазин и курсовая логика

| Переменная | Что указывать |
| --- | --- |
| `STORE_USD_TO_RUB_RATE` | например `90` |

Примечание:

- проект уже работает в рублевой логике, так что это значение сейчас скорее техническая страховка для legacy-пересчета.

## 8. Monitoring

| Переменная | Что указывать |
| --- | --- |
| `SENTRY_DSN` | DSN проекта |
| `SENTRY_ERROR_SAMPLE_RATE` | например `1` |
| `SENTRY_WARNING_SAMPLE_RATE` | например `0.25` |
| `SENTRY_INFO_SAMPLE_RATE` | например `0.05` |

Примечание:

- `SENTRY_DSN` не обязателен для первого старта, но очень желателен для публичного запуска.

## 9. Минимальный production env пример

```text
NODE_ENV=production
APP_URL=https://rsh-store.ru
COOKIE_DOMAIN=rsh-store.ru

DATABASE_URL=postgresql://rsh_user:strong_password@10.0.0.12:6432/rsh?sslmode=require
DIRECT_URL=postgresql://rsh_user:strong_password@10.0.0.12:5432/rsh?sslmode=require
REDIS_URL=rediss://default:password@10.0.0.13:6379

JWT_ACCESS_SECRET=replace-with-random-64-plus-character-secret
JWT_REFRESH_SECRET=replace-with-different-random-64-plus-character-secret
JWT_KEY_ID=rsh-prod-v1
REFRESH_TOKEN_PEPPER=replace-with-random-32-plus-character-pepper
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30

PAYMENT_PROVIDER=cloudpayments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_CURRENCY=rub
CLOUDPAYMENTS_PUBLIC_ID=pk_xxxxxxxxx
CLOUDPAYMENTS_API_SECRET=xxxxxxxxx

UPLOAD_PROVIDER=local
UPLOADTHING_TOKEN=
UPLOADTHING_APP_ID=

STORE_USD_TO_RUB_RATE=90

SENTRY_DSN=
SENTRY_ERROR_SAMPLE_RATE=1
SENTRY_WARNING_SAMPLE_RATE=0.25
SENTRY_INFO_SAMPLE_RATE=0.05
```

## 10. Что выполнить после заполнения env

```powershell
node scripts/deploy-env-check.mjs .env.production.example
npm run prisma:generate
npm run prisma:deploy
npm run build
```

После этого уже отдельно пройти руками:

- регистрация;
- логин;
- каталог;
- корзина;
- checkout;
- заказ в профиле;
- webhook-подтверждение оплаты.
