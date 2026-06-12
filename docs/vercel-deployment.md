# Deploy RSH on Vercel

Этот гайд нужен для первого `preview` и `production` деплоя проекта RSH. Локально сайт может работать через Docker, но для публичного запуска нужны managed-сервисы: PostgreSQL, Redis, UploadThing и Stripe.

## 1. Что подготовить

- GitHub repository: `lonelyy228/proekt`
- аккаунт Vercel, подключенный к GitHub
- Neon PostgreSQL или Vercel Postgres
- Upstash Redis
- UploadThing app для изображений и дизайн-ассетов
- Stripe account
- публичный домен для production

Пока домен не подключен, можно использовать preview URL от Vercel, но production-куки и финальная интеграция Stripe должны работать уже на реальном домене.

## 2. Создание проекта в Vercel

1. Открой `Vercel Dashboard`
2. Нажми `Add New` -> `Project`
3. Выбери репозиторий `lonelyy228/proekt`
4. Framework должен определиться как `Next.js`
5. Укажи Build Command:

```bash
npm run build
```

6. Укажи Install Command:

```bash
npm install
```

7. `Output Directory` не указывай

## 3. Подключение базы данных

Рекомендуемый вариант: `Neon`

1. Создай новый проект в Neon
2. Скопируй pooled connection string в `DATABASE_URL`
3. Скопируй direct connection string в `DIRECT_URL`
4. Для production в строках подключения должен быть `sslmode=require`

Пример:

```text
DATABASE_URL=postgresql://user:password@ep-example-pooler.region.aws.neon.tech/rsh?sslmode=require
DIRECT_URL=postgresql://user:password@ep-example.region.aws.neon.tech/rsh?sslmode=require
```

## 4. Подключение Redis

Рекомендуемый вариант: `Upstash Redis`

1. Создай Redis database
2. Скопируй TLS URL
3. Добавь его в Vercel как `REDIS_URL`

Пример:

```text
REDIS_URL=rediss://default:password@host.upstash.io:6379
```

## 5. Подключение UploadThing

1. Создай app в UploadThing
2. Скопируй `UPLOADTHING_TOKEN`
3. Скопируй `UPLOADTHING_APP_ID`
4. Добавь обе переменные в Vercel

Важно: в production нельзя хранить загруженные файлы на файловой системе Vercel. В базе должны лежать только URL и metadata.

## 6. Подключение Stripe

1. Подготовь live-ключи Stripe для production
2. Добавь в Vercel:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CURRENCY=rub
```

3. После первого deploy создай webhook endpoint:

```text
https://your-domain.ru/api/webhooks/stripe
```

4. Включи события:

```text
checkout.session.completed
payment_intent.succeeded
payment_intent.payment_failed
charge.refunded
```

## 7. Переменные окружения

Открой `Project Settings` -> `Environment Variables` и перенеси значения из `.env.production.example`.

Обязательные переменные:

```text
NODE_ENV
APP_URL
COOKIE_DOMAIN
DATABASE_URL
DIRECT_URL
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_KEY_ID
REFRESH_TOKEN_PEPPER
ACCESS_TOKEN_TTL_SECONDS
REFRESH_TOKEN_TTL_DAYS
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_CURRENCY
STORE_USD_TO_RUB_RATE
UPLOADTHING_TOKEN
UPLOADTHING_APP_ID
```

Для генерации секретов в PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Секреты должны быть разными. Нельзя использовать локальные demo/test значения в production.

## 8. Проверка env перед деплоем

Локально:

```powershell
npm run deploy:env-check -- .env.production.example
```

Во время production build приложение само проверит runtime-конфигурацию через `src/config/env.ts`, но локальная команда быстрее показывает, чего не хватает.

## 9. Миграции базы

Для production нельзя полагаться только на `prisma db push`. Нужен миграционный путь:

```bash
npm run prisma:deploy
npm run db:preflight
```

Перед публичным деплоем нужно убедиться, что папка `prisma/migrations` актуальна и закоммичена.

## 10. Первый deploy

1. Push в `develop`
2. Дождись GitHub checks
3. На Vercel дождись auto-deploy или запусти deploy вручную
4. После deploy проверь:

```text
/
/catalog
/product/<slug>
/cart
/login
/register
/editor
/admin
```

5. Выполни smoke-проверку:

- регистрация пользователя
- логин/логаут
- добавление товара в корзину
- создание checkout session
- просмотр заказа в профиле
- доступ администратора к `/admin`

## 11. Типовые проблемы

- `Invalid production environment configuration`
  - неверно заполнены переменные в Vercel
- `prisma migrate deploy failed`
  - проблема в `DATABASE_URL` / `DIRECT_URL` или миграциях
- `Stripe webhook 400`
  - неверный `STRIPE_WEBHOOK_SECRET`
- `UploadThing 401/403`
  - неверный `UPLOADTHING_TOKEN` или `UPLOADTHING_APP_ID`

Не отключай production validation ради быстрого деплоя. Эта проверка защищает от небезопасной конфигурации.
