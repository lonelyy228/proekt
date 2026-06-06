# Deploy RSH на Vercel

Этот гайд нужен для первого production/preview-деплоя RSH. Локально сайт может работать на Docker, но на хостинге нужны managed-сервисы: Postgres, Redis, UploadThing и Stripe.

## 1. Что подготовить

- GitHub repository: `lonelyy228/proekt`.
- Vercel аккаунт, подключенный к GitHub.
- Neon PostgreSQL или Vercel Postgres.
- Redis provider: Upstash Redis подходит проще всего.
- UploadThing app для изображений и дизайн-ассетов.
- Stripe account.
- Домен. Пока домена нет, можно использовать Vercel preview URL, но для production лучше свой домен.

## 2. Создать проект в Vercel

1. Открой Vercel Dashboard.
2. Нажми `Add New` -> `Project`.
3. Выбери репозиторий `lonelyy228/proekt`.
4. Framework должен определиться как `Next.js`.
5. Build Command оставь стандартный или укажи:

```bash
npm run build
```

6. Install Command:

```bash
npm install
```

7. Output Directory не указывай.

## 3. Подключить Postgres

Рекомендуемый вариант: Neon.

1. Создай Neon project.
2. Скопируй pooled connection string в `DATABASE_URL`.
3. Скопируй direct connection string в `DIRECT_URL`.
4. В обеих строках должен быть `sslmode=require`.

Пример:

```text
DATABASE_URL=postgresql://user:password@ep-example-pooler.region.aws.neon.tech/rsh?sslmode=require
DIRECT_URL=postgresql://user:password@ep-example.region.aws.neon.tech/rsh?sslmode=require
```

## 4. Подключить Redis

Рекомендуемый вариант: Upstash Redis.

1. Создай Redis database.
2. Скопируй TLS URL.
3. Вставь в Vercel как `REDIS_URL`.

Пример:

```text
REDIS_URL=rediss://default:password@host.upstash.io:6379
```

## 5. Подключить UploadThing

1. Создай app в UploadThing.
2. Скопируй `UPLOADTHING_TOKEN`.
3. Скопируй `UPLOADTHING_APP_ID`.
4. Добавь обе переменные в Vercel.

Важно: в production нельзя хранить uploads на Vercel filesystem. Только URL и metadata в базе.

## 6. Подключить Stripe

1. В Stripe включи live mode, когда будешь готов принимать реальные платежи.
2. Добавь в Vercel:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_CURRENCY=rub
```

3. После первого Vercel deploy создай webhook endpoint:

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

5. Скопируй webhook signing secret в `STRIPE_WEBHOOK_SECRET`.

## 7. Добавить env variables в Vercel

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

Секреты должны быть разными. Не вставляй локальные demo/test значения в production.

## 8. Проверить env перед деплоем

Локально можно проверить файл:

```powershell
npm run deploy:env-check -- .env.production.example
```

Для Vercel проверка произойдёт во время build через runtime validation, но локальная команда быстрее показывает, чего не хватает.

## 9. Миграции базы

Для production нельзя полагаться на `prisma db push`. Нужен миграционный путь:

```bash
npm run prisma:deploy
npm run db:preflight
```

В Vercel это обычно делают через CI/job перед production deploy или вручную в trusted terminal с production env.

Если база пустая, `prisma migrate deploy` создаст таблицы из файлов в `prisma/migrations`.

## 10. Первый деплой

1. Push в `develop`.
2. Дождись GitHub checks.
3. На Vercel нажми deploy или дождись auto-deploy.
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

5. Сделай smoke-сценарий:

- регистрация пользователя;
- добавление товара в корзину;
- вход/выход;
- оформление заказа;
- просмотр заказа в профиле;
- админка открывается только ADMIN.

## 11. Если деплой упал

- `Invalid production environment configuration` означает, что Vercel env заполнен неправильно.
- `prisma migrate deploy` failed означает проблему с DB URL или миграциями.
- Stripe webhook 400 обычно означает неверный `STRIPE_WEBHOOK_SECRET`.
- Upload 401/403 обычно означает неверный UploadThing token/app id.

Не отключай production validation ради быстрого deploy. Она защищает от небезопасной конфигурации.
