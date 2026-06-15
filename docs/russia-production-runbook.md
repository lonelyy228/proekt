# RSH Russia Production Runbook

Этот runbook нужен для реального запуска RSH в инфраструктуре, которая подходит под РФ и не зависит от `Vercel + Neon + Stripe`.

## 1. Рекомендуемый стек

### Вариант A. Лучший баланс скорости и надежности

- `App / Next.js`: Linux VM
- `Reverse proxy`: Nginx
- `Process manager`: PM2 или `systemd`
- `Database`: managed PostgreSQL в РФ-облаке
- `Redis`: managed Redis / Valkey в РФ-облаке
- `Payments`: CloudPayments
- `Uploads`: локально на сервере (`UPLOAD_PROVIDER=local`)
- `TLS`: сертификат на балансере или на самом сервере

Это лучший стартовый вариант для текущего состояния проекта, потому что код уже готов к `cloudpayments + local upload`, а значит мы не добавляем новый нестабильный слой перед релизом.

### Вариант B. Самый быстрый старт

- один Linux VM;
- PostgreSQL на том же VM;
- Redis на том же VM;
- CloudPayments;
- локальные uploads;
- Nginx + `systemd`.

Этот вариант быстрее поднять, но он слабее по отказоустойчивости. Я бы использовал его только для soft launch или private demo.

## 2. Что лучше брать из провайдеров

### Route 1. Selectel

Подходит, если хочешь собрать почти весь стек у одного провайдера.

По официальной документации у Selectel есть:

- Cloud Servers для VM [Create a cloud server](https://docs.selectel.ru/en/cloud-servers/create/create-server/)
- Managed Databases и Redis [Managed Databases](https://docs.selectel.ru/en/managed-databases/) и [Redis](https://docs.selectel.ru/en/managed-databases/redis/)
- S3-compatible object storage [S3 Product Description](https://docs.selectel.ru/en/s3/about/about-s3/)
- Load balancer с TLS termination [Load Balancer TLS(SSL) Certificates](https://docs.selectel.ru/en/cloud-servers/load-balancers/manage/ssl-certificates/)

Из документации видно:

- сервер можно создать через Control Panel, CLI или Terraform;
- Selectel S3 поддерживает `S3 API`;
- Selectel S3 по умолчанию заявлен как соответствующий `152-ФЗ`;
- на load balancer TLS завершается на балансере.

### Route 2. Yandex Cloud

Подходит, если хочешь более привычный managed-контур и сервисы типа secret manager / certificate manager.

По официальной документации у Yandex Cloud есть:

- VM [Creating a Linux VM](https://yandex.cloud/en/docs/compute/quickstart/quick-create-linux)
- Managed PostgreSQL [Getting started with Managed Service for PostgreSQL](https://yandex.cloud/en/docs/managed-postgresql/quickstart)
- Certificate Manager integrations [Integration with Yandex Cloud services](https://yandex.cloud/en/docs/certificate-manager/concepts/services)
- HTTPS для Object Storage [Configuring HTTPS for hosting in Yandex Object Storage](https://yandex.cloud/en/docs/storage/operations/hosting/certificate)

Из документации видно:

- VM поднимается через Compute Cloud;
- Managed PostgreSQL создается в `PRODUCTION` environment;
- хостам БД можно включить `Public access`, но безопаснее держать их в приватной сети;
- сертификаты Certificate Manager можно использовать с Object Storage и другими сервисами.

### Мой практический выбор для этого проекта

Если запускать RSH в ближайшее время, я бы рекомендовал:

1. `Selectel VM + Selectel Managed PostgreSQL + Selectel Managed Redis + CloudPayments`
2. или `Yandex Cloud VM + Yandex Managed PostgreSQL + Yandex Managed Redis/Valkey + CloudPayments`

Причина:

- это укладывается в российскую инфраструктуру;
- это проще сопровождать, чем городить обходные пути вокруг `Vercel/Stripe`;
- текущий код уже почти совпадает с этим стеком.

## 3. Что не надо делать прямо сейчас

- не возвращаться к `Stripe` как основному production-провайдеру для РФ;
- не тащить обратно `Vercel-only` схему как обязательную;
- не внедрять новый upload provider перед самым релизом, если `local` уже закрывает задачу;
- не переносить все сразу на Kubernetes, пока не закрыт стабильный eCommerce flow.

## 4. Актуальная mapping-логика env

Используй [docs/production-env-mapping.md](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/docs/production-env-mapping.md).

Ключевые значения для первого production:

- `PAYMENT_PROVIDER=cloudpayments`
- `UPLOAD_PROVIDER=local`
- `STRIPE_PRICE_CURRENCY=rub`
- `APP_URL=https://<your-domain>`
- `COOKIE_DOMAIN=<your-domain>`

## 5. Порядок выкладки

### Шаг 1. Подготовить инфраструктуру

Подними:

- VM для Next.js;
- PostgreSQL;
- Redis;
- домен;
- TLS;
- секреты CloudPayments.

### Шаг 2. Залить env

Заполни production env по [docs/production-env-mapping.md](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/docs/production-env-mapping.md).

### Шаг 3. Проверить приложение локально на production env

```powershell
node scripts/deploy-env-check.mjs .env.production.example
npm run prisma:generate
npm run prisma:deploy
npm run build
```

### Шаг 4. Развернуть приложение на VM

Минимальный принцип:

- `npm ci`
- `npm run prisma:deploy`
- `npm run build`
- `npm run start`

Дальше завернуть это в `systemd` или `pm2`, а наружу отдать через `nginx`.

Готовые шаблоны в репозитории:

- [deploy/rsh.service.example](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/deploy/rsh.service.example)
- [deploy/nginx.rsh.conf.example](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/deploy/nginx.rsh.conf.example)
- [deploy/deploy-vm.sh.example](C:/Users/rs998/Documents/Codex/principal-full-stack-engineer-solution-architect/deploy/deploy-vm.sh.example)

### Шаг 5. Подключить CloudPayments callback

В кабинете CloudPayments укажи:

- `https://<your-domain>/api/webhooks/cloudpayments/check`
- `https://<your-domain>/api/webhooks/cloudpayments/pay`
- `https://<your-domain>/api/webhooks/cloudpayments/fail`

### Шаг 6. Пройти smoke test

Обязательно руками:

- register;
- login;
- cart;
- wishlist;
- post-login cart continuity;
- checkout;
- order visibility in profile;
- один реальный платеж;
- один failed payment сценарий.

## 6. Что является лучшим следующим кодовым шагом

После первого запуска самый полезный следующий апгрейд:

1. добавить S3-compatible upload provider для Selectel/Yandex Object Storage;
2. вынести user-uploaded assets из локальной файловой системы VM;
3. затем закрыть monitoring и backup automation.

То есть сейчас правильная стратегия такая:

- сначала стабильный production на `local uploads`;
- потом безопасная миграция на S3 provider.
