# RSH VM Deploy Checklist

Этот чеклист нужен, чтобы не пропустить шаги при первом production-запуске на Linux VM.

## До выкладки

- есть Linux VM с публичным IP;
- домен уже смотрит на VM или на балансер;
- выдан TLS-сертификат;
- подготовлены `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`;
- подготовлены `CLOUDPAYMENTS_PUBLIC_ID` и `CLOUDPAYMENTS_API_SECRET`;
- решено, где будут храниться user uploads и backups.

## На сервере

### 1. Подготовить окружение

- установить `node`, `npm`, `git`, `nginx`;
- создать директорию `/var/www/rsh`;
- положить проект в `/var/www/rsh`;
- создать файл `/var/www/rsh/.env.production`.

### 2. Заполнить env

Использовать шаблон:

- [.env.production.example](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/.env.production.example)

Главное проверить:

- `APP_URL=https://your-domain.ru`
- `COOKIE_DOMAIN=your-domain.ru`
- `PAYMENT_PROVIDER=cloudpayments`
- `UPLOAD_PROVIDER=local`

### 3. Проверить сборку

```bash
cd /var/www/rsh
npm ci
node scripts/deploy-env-check.mjs .env.production
npm run prisma:deploy
npm run build
```

### 4. Подключить сервис

- скопировать [deploy/rsh.service.example](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/deploy/rsh.service.example) в `/etc/systemd/system/rsh.service`
- скорректировать `User`, `Group`, `WorkingDirectory`
- выполнить:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rsh
sudo systemctl restart rsh
sudo systemctl status rsh
```

### 5. Подключить nginx

- скопировать [deploy/nginx.rsh.conf.example](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/deploy/nginx.rsh.conf.example)
- подставить свой домен и пути к сертификатам
- выполнить:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Подключить CloudPayments webhook

В кабинете CloudPayments указать:

- `https://your-domain.ru/api/webhooks/cloudpayments/check`
- `https://your-domain.ru/api/webhooks/cloudpayments/pay`
- `https://your-domain.ru/api/webhooks/cloudpayments/fail`

## После выкладки

Пройти руками:

- регистрация;
- логин;
- каталог;
- добавление товара в корзину;
- wishlist;
- checkout;
- реальная успешная оплата;
- заказ в профиле;
- failed payment сценарий;
- проверка админки заказов.
