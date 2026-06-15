# 1. Executive Summary

- Проект называется **RSH**.
- Это **русскоязычный интернет-магазин одежды** с двумя продуктовыми сценариями:
  - продажа обычных брендовых вещей;
  - кастомизация только линейки **RSH BASICS** через **2D Lab**.
- Брендовые вещи продаются как стандартные товары каталога и **не должны** кастомизироваться в редакторе.
- Линейка **RSH BASICS** предназначена для кастомизации: футболки, худи, шорты и другие базовые изделия.
- Технологический стек проекта: **Next.js 14 App Router, React 18, TypeScript strict, Prisma, PostgreSQL, Redis, Stripe, UploadThing, Fabric.js, Zod, Zustand, TanStack Query**.
- Архитектурный подход: **modular monolith** с разделением слоев `UI -> hooks/store -> route handlers/server actions -> services -> repositories -> Prisma/PostgreSQL`.
- В проекте уже существует и в значительной степени работает:
  - главная страница;
  - каталог;
  - фильтрация;
  - карточки товаров;
  - регистрация и логин;
  - профиль;
  - избранное;
  - корзина;
  - админ-панель;
  - legal/service страницы;
  - базовый 2D editor / 2D Lab.
- Проект уже **не находится на нулевой стадии**: он на продвинутой локальной / демо-готовой стадии.
- Сайт уже показывался, пользователь использовал его в контексте дипломной работы и готовил материалы/скриншоты по нему.
- При этом проект **еще не доведен до production-ready на 100%**:
  - публичный production deploy не завершен;
  - часть core eCommerce flow требует финальной стабилизации;
  - Stripe/UploadThing/production env wiring пока не закончены;
  - мониторинг и production security финально не закрыты.
- **Текущий главный фокус**: стабилизация ядра магазина, buyer flow, checkout/orders/profile consistency, наполнение каталога, deploy readiness.
- **Финальная полировка 2D editor сознательно отложена на более поздний этап**, хотя редактор уже существует и работает.
- Новый чат Codex не должен начинать с полного redesign editor UX. Сначала нужно закрыть core commerce flow и production readiness.

# 2. Project Identity

## 2.1. Название и позиционирование

- Название продукта: **RSH**
- Визуальная идея проекта:
  - строгий;
  - минималистичный;
  - нишевый;
  - русскоязычный;
  - визуально сдержанный, без “маркетплейсной перегруженности”.

## 2.2. Что это за продукт

RSH — это интернет-магазин одежды, сочетающий:

1. **обычную продажу брендовых вещей**;
2. **отдельный контур кастомизации базовых вещей** через `RSH BASICS` и `2D Lab`.

То есть это не просто каталог + корзина. В проекте есть:

- отдельная доменная логика для аутентификации;
- полноценный административный контур;
- buyer flow;
- заготовка production deployment;
- редактор кастомизации одежды.

## 2.3. Целевая аудитория

- Пользователи, которым интересны брендовые вещи в русскоязычном интерфейсе.
- Пользователи, которым интересна персонализация базовой одежды.
- Пользователи, которым важны:
  - минималистичный интерфейс;
  - понятный каталог;
  - строгий визуальный стиль;
  - кастомизация без смешивания с branded-инвентарем.

## 2.4. Почему проект не равен “обычному CRUD-магазину”

Проект существенно шире простого демо-магазина, потому что в нем уже заложены:

- сервисный слой;
- repository layer;
- Prisma schema с набором реальных доменных моделей;
- refresh-token auth flow;
- админка с аналитикой и operational screens;
- 2D editor с шаблонами одежды;
- подготовка к реальному deploy в Vercel/Neon/Stripe/UploadThing.

# 3. Business Model and Product Rules

## 3.1. Две продуктовые линии

В проекте есть две логики товаров:

### 1. Брендовые вещи

Примеры брендов, использованных в проекте и пользовательском позиционировании:

- Nike
- Adidas
- Puma
- Timberland
- Maison Margiela
- Gucci
- Balenciaga
- Off-White
- Stone Island
- New Balance

Эти товары:

- продаются как обычные позиции каталога;
- имеют карточки, фильтры, брендовые метки, галереи изображений;
- **не должны** уходить в 2D Lab;
- **не должны** кастомизироваться пользователем.

### 2. Линейка `RSH BASICS`

Это отдельная базовая линейка, предназначенная для кастомизации.

Сюда относятся:

- футболки;
- худи;
- шорты;
- потенциально другие базовые изделия в дальнейшем.

Эти товары:

- могут покупаться как обычные basics-товары;
- либо использоваться как база для кастомизации;
- должны быть связаны с 2D Lab.

## 3.2. Правило кастомизации

Кастомизация разрешена **только** для `RSH BASICS`.

Ключевое бизнес-правило проекта:

- **Branded catalog != customizable inventory**
- **Basics catalog = customizable inventory**

Новый чат не должен ломать это разделение.

## 3.3. Что должно сохраняться у кастомной вещи

Для кастомного изделия целевая модель сохранения должна включать:

- `fabric JSON` — как исходное описание редакторной сцены;
- `preview image` — как превью для показа в профиле/корзине/заказе;
- связь с базовым товаром или вариантом;
- метаданные цвета, стороны, области печати и других настроек, если они есть.

## 3.4. Правило карточки basic-товара

Для товара из `RSH BASICS` карточка должна поддерживать два сценария:

1. Купить как обычный товар.
2. Открыть `2D Lab` и персонализировать.

## 3.5. Продуктовый приоритет пользователя

Пользователь отдельно подчеркивал:

- на сайте **в основном продаются обычные брендовые вещи**;
- `2D Lab` — важная, но отдельная feature-линия;
- нельзя превращать весь магазин в один большой кастомайзер.

## 3.6. Юридическая ремарка

Для публичной продажи брендовых вещей нужны:

- подтвержденные поставщики;
- подтверждение происхождения товара;
- право на коммерческую реализацию соответствующих торговых марок.

Это важно зафиксировать: технически проект может поддерживать каталог брендов, но публичный production-магазин с такими брендами требует юридически корректной товарной цепочки.

# 4. Current Technical Stack

## 4.1. Frontend

### Next.js 14 App Router

Используется как основа приложения:

- маршрутизация;
- server/client boundaries;
- layouts;
- SSR/RSC-подход;
- API route handlers.

### React 18

Используется для UI и интерактивных клиентских модулей:

- auth forms;
- cart UI;
- wishlist interactions;
- admin interactions;
- 2D editor interface.

### TypeScript strict

Используется для:

- строгой типизации DTO;
- типизации сервисов и репозиториев;
- снижения регрессионных ошибок;
- контроля сложных доменных связей.

### Tailwind CSS

Используется для стилизации интерфейса.
Проект визуально строится на минималистичном светлом стиле с большим количеством белых контейнеров, тонких бордеров и строгой типографики.

## 4.2. State / Client Data

### Zustand

Используется как lightweight client-state layer, прежде всего для:

- guest-side cart helpers;
- editor-related local state;
- краткоживущих UI-состояний.

### TanStack Query

Используется для:

- клиентской синхронизации данных;
- optimistic UX;
- обновления server-backed сущностей на клиенте.

## 4.3. Backend / Domain

### Prisma

Используется как ORM и схема доменных моделей:

- users;
- sessions;
- products;
- variants;
- carts;
- orders;
- designs;
- admin presets;
- audit logs.

### PostgreSQL

Основное хранилище проекта.
Локально поднимается через Docker.
Целевой production-вариант — **Neon**.

### Redis / Upstash

Используется / запланирован для:

- rate limiting;
- transient infra;
- production-safe ограничений и анти-абьюза.

## 4.4. Validation / Security

### Zod

Используется на границах приложения для:

- request validation;
- DTO validation;
- route/service guard logic.

### JWT + refresh tokens

Используется с короткоживущими access-токенами и rotating refresh-токенами.

### HttpOnly cookies

Используются как безопасный носитель auth/session state.

## 4.5. Payments / Uploads / Editor

### Stripe

Используется / запланирован для:

- checkout sessions;
- webhook-based order finalization;
- post-payment order state changes.

### UploadThing

Используется / запланирован как production-safe upload layer.
Важно: проект не должен зависеть от локального файлового хранилища Vercel filesystem в production.

### Fabric.js

Используется как основа `2D Lab`:

- canvas;
- текст;
- фото;
- перемещение;
- масштабирование;
- редактируемые объекты.

## 4.6. Observability / Infra

### Pino

Используется как логгер.

### Vercel

Целевой production hosting.

### Neon

Целевая production PostgreSQL база.

### Sentry / аналог

Планируется / требуется как production monitoring layer.

## 4.7. Честный текущий статус по стеку

### Уже реально интегрировано и используется

- Next.js
- React
- TypeScript
- Tailwind
- Prisma
- PostgreSQL
- Zod
- Zustand
- TanStack Query
- auth stack
- Fabric.js editor base
- базовая Stripe-архитектура
- базовая UploadThing-архитектура

### Подготовлено архитектурно, но не доведено production-эксплуатационно

- полноценный production Stripe flow;
- финальный UploadThing production wiring;
- Vercel + Neon + Upstash production finish;
- monitoring / backup / incident layer.

# 5. Repository and Folder Map

## 5.1. Корень проекта

Рабочая директория:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect`

## 5.2. `src/app`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\app`

Отвечает за:

- App Router pages;
- layouts;
- route handlers;
- public pages;
- auth pages;
- profile/admin/editor/catalog pages.

Что тут обычно менять:

- страницы;
- route composition;
- RSC-level layout behavior;
- page-level loading/error behavior.

Содержит важные разделы:

- `admin`
- `api`
- `cart`
- `catalog`
- `checkout`
- `contacts`
- `delivery`
- `editor`
- `favorites`
- `login`
- `offer`
- `privacy`
- `product`
- `profile`
- `register`
- `returns`
- `terms`

## 5.3. `src/components`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\components`

Отвечает за общие UI-компоненты.
Туда не должна утекать доменная бизнес-логика.

## 5.4. `src/features`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\features`

Это доменные модули проекта.

Содержит:

- `admin`
- `auth`
- `cart`
- `catalog`
- `checkout`
- `editor`
- `orders`
- `wishlist`

Что важно:

- именно здесь логично искать feature-specific UI, hooks и вспомогательные модели;
- новый чат должен мыслить проект через `features`, а не как через хаотичный набор страниц.

## 5.5. `src/server/services`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\server\services`

Это главный business-logic layer.

Там лежат:

- `auth-service.ts`
- `cart-service.ts`
- `checkout-service.ts`
- `product-service.ts`
- `design-service.ts`
- `order-service.ts`
- `wishlist-service.ts`
- большой набор `admin-*` сервисов

Правило:

- сюда нужно помещать бизнес-логику;
- сюда не должны попадать UI-детали;
- route handlers должны быть thin и вызывать сервисы.

## 5.6. `src/server/repositories`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\server\repositories`

Это data-access layer.

Там сосредоточены Prisma-запросы.

Правило:

- репозитории должны работать с Prisma;
- они не должны разрастаться в бизнес-оркестраторы;
- сложные workflow решения должны оставаться в `services`.

## 5.7. `src/server/validators`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\server\validators`

Используются для:

- Zod-схем;
- DTO validation;
- request payload checks.

## 5.8. `src/server/utils`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\server\utils`

Содержит инфраструктурные и доменные вспомогательные функции:

- auth helpers;
- cookie helpers;
- env helpers;
- image validation;
- checkout utilities;
- ops/logging helpers.

## 5.9. `src/store`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\store`

Содержит Zustand stores и related local state logic.

## 5.10. `src/lib`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\lib`

Содержит общие reusable библиотечные helpers:

- logger;
- uploadthing client adapters;
- guest cart merge helpers;
- formatters и т.д.

## 5.11. `src/config`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\config`

Содержит:

- env loading;
- constants;
- customizer config;
- application-level presets.

## 5.12. `src/types`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\src\types`

Содержит общие типы и доменные type helpers.

## 5.13. `prisma`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\prisma`

Содержит:

- `schema.prisma`
- seed logic
- миграционную историю, если она присутствует

Что здесь обычно менять:

- доменные модели;
- индексы/relations;
- сиды;
- migration flow.

## 5.14. `docs`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\docs`

Очень важная папка.
Там уже накоплены:

- deploy docs;
- DB migration docs;
- release checklist;
- production readiness status;
- дипломные markdown-блоки;
- диаграммные шаблоны.

Новый чат должен использовать `docs/` как главный текстовый слой проекта.

## 5.15. `e2e`

Расположение:

`C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\e2e`

Там лежат end-to-end тесты и smoke/security сценарии.

Важно:

- ранние CI проблемы уже были связаны с тестовыми контурами;
- не нужно без необходимости ломать/массово переделывать тестовый слой, не понимая зачем.

# 6. Architecture Principles

## 6.1. Modular Monolith

Проект строился как **modular monolith**.

Это означает:

- одна кодовая база;
- один deployable unit;
- но внутри — четкое разделение по доменным модулям и слоям.

## 6.2. Thin Route Handlers

`src/app/api/*` не должны превращаться в жирные контроллеры.
Их роль:

- принять запрос;
- провалидировать;
- авторизовать;
- вызвать сервис;
- вернуть ответ.

## 6.3. Business Logic in Services

Вся основная бизнес-логика должна жить в `src/server/services`.

Примеры:

- auth workflow;
- buyer flow;
- cart merge;
- checkout orchestration;
- design persistence;
- admin operations.

## 6.4. Data Access in Repositories

Prisma-запросы должны жить в `src/server/repositories`.

Это правило нужно сохранять:

- не тащить Prisma напрямую в UI;
- не смешивать слой БД и слой бизнес-оркестрации.

## 6.5. Validation at Boundaries

Валидация должна быть на границах:

- routes;
- server actions;
- DTO parsing;
- внешние интеграции;
- пользовательские формы.

Основа — `Zod`.

## 6.6. UI Without Heavy Business Logic

React-компоненты должны заниматься:

- представлением;
- простым orchestration;
- user interactions.

Они не должны содержать:

- тяжелую доменную логику;
- сложные правила checkout/auth/cart;
- сложные трансакционные решения.

## 6.7. Auth Storage Rule

Auth tokens **не должны** храниться в `localStorage`.

Проект строился с безопасной моделью:

- access token;
- refresh token rotation;
- HttpOnly cookies.

## 6.8. Money Storage Rule

Деньги хранятся в **integer cents**.

Например:

- `351000` копеек / центов для внутреннего хранения;
- форматирование в UI — отдельный слой.

## 6.9. Auditability

Privileged actions должны иметь след:

- audit logs;
- admin action visibility;
- operations traceability.

## 6.10. Editor Isolation Rule

2D editor — важный модуль, но он **не должен ломать**:

- auth flow;
- cart flow;
- checkout flow;
- product domain.

Если есть выбор между красивой доработкой editor UX и стабильностью магазина, приоритет у магазина.

# 7. Completed Functional Areas

## 7.1. Главная страница

Статус:

- **реализовано и демо-пригодно**

Что есть:

- hero block;
- брендовая подача RSH;
- навигация в каталог;
- навигация в BASICS;
- навигация в 2D Lab;
- минималистичный визуальный стиль.

Пользователь уже делал скриншоты главной страницы для диплома.

## 7.2. Каталог

Статус:

- **реализовано и демо-пригодно**

Что есть:

- список товаров;
- бренды;
- basics;
- карточки;
- фильтры;
- пагинация / листинг.

Пользователь уже видел и скриншотил каталог.

## 7.3. Фильтры каталога

Статус:

- **работает, но требует финальной production-проверки на наполненных данных**

Что есть:

- фильтрация;
- брендовые rail/filter controls;
- цена;
- категория;
- search-related controls.

Что нужно еще:

- пройтись по реальным наполненным данным;
- убедиться, что все комбинации фильтров работают на живом каталоге.

## 7.4. Карточка товара

Статус:

- **реализовано и визуально сильно**

Что есть:

- расширенная product card;
- бренд/описание/метки;
- price block;
- выбор варианта;
- add-to-cart;
- gallery logic;
- связь с basics/custom lab для basic-товаров;
- блок похожих товаров.

Пользователь уже делал скриншоты product page.

## 7.5. Регистрация

Статус:

- **реализовано, дорабатывалось, сейчас демо-пригодно**

Что есть:

- registration form;
- валидация;
- понятные подсказки по паролю;
- улучшенная UX-подсветка требований к паролю.

Что уже исправлялось:

- ошибки валидации;
- проблема с непонятным сообщением;
- подсказки по надежности пароля.

## 7.6. Логин

Статус:

- **реализовано, но раньше были проблемы и его нужно учитывать как чувствительный flow**

Что есть:

- login page;
- auth form;
- support for 2FA code field;
- session-oriented flow.

Что уже было проблемой:

- зависание “входим”;
- неверное поведение auth;
- header state after login.

## 7.7. Профиль

Статус:

- **реализовано и пользователь уже видел UI**

Что есть:

- profile page;
- security section;
- order history section;
- user identity display.

Что важно:

- order history зависит от полноты order/checkout flow;
- эту часть еще нужно финально проверить на реальных заказах.

## 7.8. Избранное

Статус:

- **реализовано**

Что есть:

- add/remove favorite flow;
- dedicated favorites page;
- header navigation.

Нужно еще:

- финально пройти руками на production-like данных.

## 7.9. Корзина

Статус:

- **реализовано, но buyer flow остается чувствительной зоной**

Что есть:

- cart page;
- guest-side behavior;
- authenticated cart logic;
- переход к checkout.

Критично:

- guest cart не должен пропадать после логина;
- merge корзины после логина — отдельный high-priority сценарий.

## 7.10. Админка

Статус:

- **реализовано и очень сильна визуально/структурно для демо**

Что есть:

- dashboard;
- users;
- products;
- orders;
- content;
- sessions;
- webhooks;
- logs;
- settings;
- backups/ops-related surfaces.

Пользователь уже показывал скриншоты админки.

## 7.11. Legal / Service pages

Статус:

- **частично реализовано, базовые страницы уже есть**

Есть маршруты:

- `delivery`
- `returns`
- `contacts`
- `privacy`
- `terms`
- `offer`

Нужно:

- финализировать контент и production wording.

## 7.12. Базовый 2D Lab

Статус:

- **реализовано, работает, но не считается финально доведенным**

Что есть:

- basic editor UI;
- templates;
- front/back logic;
- text and image controls;
- color controls;
- save/add-to-cart related workflow foundation.

Что остается:

- шаблоны;
- printable zones;
- UX polishing;
- mobile behavior;
- deeper editor quality.

# 8. Partially Completed / Unstable Areas

## 8.1. Buyer flow

Статус:

- **частично готов / чувствительный**

Нужно внимательно проверять:

- login -> cart continuity;
- guest -> auth transition;
- custom item -> cart -> checkout path.

## 8.2. Post-login cart merge

Статус:

- **критично важный и еще не должен считаться полностью закрытым без ручного smoke-test**

Пользователь прямо просил, чтобы товары после авторизации не пропадали.

## 8.3. Checkout stability

Статус:

- **архитектурно реализовано, production-complete пока нет**

Нужно проверить:

- checkout sessions;
- redirect flow;
- recovery/cancel/success;
- order appearance after payment.

## 8.4. Profile order history

Статус:

- **есть UI, но требует проверки на реальных order states**

## 8.5. Deploy readiness

Статус:

- **подготовлено частично, не завершено**

Есть:

- docs;
- roadmap;
- понимание infra stack;
- частично начатые Neon/Vercel шаги.

Нет:

- завершенного production deploy;
- завершенного env wiring;
- smoke-tested public deployment.

## 8.6. Stripe real integration

Статус:

- **частично**

Нужны:

- реальные production/test keys;
- webhook wiring;
- order finalization verification.

## 8.7. UploadThing production usage

Статус:

- **подготовлено, но production-complete не подтверждено**

## 8.8. Security / monitoring finalization

Статус:

- **архитектурно заложено, эксплуатационно не закрыто**

## 8.9. 2D editor final UX and template quality

Статус:

- **осознанно отложено**

Причина:

- сначала нужен стабильный магазин и deploy readiness.

# 9. Detailed Timeline of What Was Already Done

## 9.1. Архитектурная база

На раннем этапе была собрана production-oriented архитектурная основа:

- Next.js 14 App Router;
- strict TypeScript;
- `src/features` как доменные модули;
- `services` + `repositories`;
- `validators`;
- modular monolith structure.

## 9.2. Подключение зависимостей и инфраструктурного скелета

Были подключены:

- Prisma;
- PostgreSQL;
- Redis-oriented dependencies;
- Stripe SDK;
- UploadThing;
- Fabric.js;
- auth/security libraries;
- testing/tooling stack.

## 9.3. Проектирование Prisma schema

Далее собиралась доменная схема:

- users;
- sessions;
- refresh tokens;
- categories;
- products;
- variants;
- images;
- carts;
- orders;
- customization designs;
- audit/admin preset structures.

## 9.4. Аутентификация и security-контур

После этого был построен auth layer:

- register;
- login;
- logout;
- refresh flow;
- roles;
- cookies;
- refresh rotation;
- rate limiting / security helpers.

## 9.5. Middleware и access rules

Затем добавлялись:

- middleware guards;
- protected user/admin routes;
- RBAC-related checks;
- privileged flow restrictions.

## 9.6. Каталог и product flow

После базового security слоя развивались:

- home;
- catalog;
- product card;
- basics flow;
- filters and categories.

## 9.7. Cart / wishlist

Затем строились:

- wishlist;
- guest cart;
- authenticated cart;
- add/remove/update flows.

## 9.8. Профиль пользователя

Потом появилась account surface:

- profile;
- security section;
- order history UI.

## 9.9. Admin modules

Один из крупных этапов — развитие админки:

- admin dashboard;
- products management;
- users management;
- order screens;
- sessions;
- webhooks;
- logs;
- settings;
- content;
- backups/ops views.

## 9.10. 2D Lab

Затем строился 2D editor:

- Fabric.js canvas;
- templates;
- text controls;
- image controls;
- color logic;
- basic save/add-to-cart path.

## 9.11. CI / deploy readiness / branch protection

Отдельный пласт работы:

- CI gates;
- release checks;
- preview smoke;
- branch protection setup;
- prepare database issues;
- GitHub merge workflow stabilization.

## 9.12. Buyer flow fixes

Позже отдельными правками стабилизировались:

- login behavior;
- checkout recovery;
- cart continuity;
- auth-state UX.

## 9.13. Product gallery and content-oriented improvements

Отдельными PR добавлялись:

- product gallery improvements;
- multiple product images;
- richer product cards;
- buyer-oriented polish.

## 9.14. Registration UX improvements

Были доработаны:

- password validation;
- readable registration guidance;
- clearer auth feedback.

## 9.15. Continuing stabilization

Текущее состояние — это уже не “строим с нуля”, а:

- стабилизируем;
- дополняем;
- готовим к production.

## 9.16. Что пользователь уже делал вручную

Пользователь многократно сам:

- создавал PR в GitHub;
- делал merge через GitHub UI;
- разбирался с Git/Vim ситуациями;
- поднимал Docker Desktop;
- запускал PostgreSQL и Redis локально;
- запускал `npm run dev`;
- работал с Neon setup;
- работал с Vercel setup;
- добавлял товары;
- подготавливал и делал скриншоты интерфейса;
- собирал материалы для диплома;
- собирал примеры аналогов.

Это важный контекст: новый чат работает не только с кодом, но и с активным ручным участием пользователя.

# 10. Local Development Setup

## 10.1. Среда пользователя

- ОС: **Windows**
- Терминал: **PowerShell / VS Code terminal**
- Локальная контейнеризация: **Docker Desktop**
- Дополнительно пользователь уже работал с WSL/Docker setup ранее

## 10.2. Типовой локальный запуск

Из корня проекта:

```powershell
cd "C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect"
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:deploy
npm run db:preflight
npm run seed
npm run dev
```

## 10.3. Проверка dev-сервера

Обычно приложение открывается по:

- `http://localhost:3000`

Если порт `3000` занят, Next.js может автоматически подняться на:

- `http://localhost:3001`

Это уже происходило в реальной работе пользователя.

## 10.4. Как открыть Prisma Studio

```powershell
npm run prisma:studio
```

Либо эквивалент:

```powershell
npx prisma studio
```

## 10.5. Что смотреть в Prisma Studio чаще всего

Чаще всего полезны модели:

- `User`
- `Product`
- `ProductVariant`
- `ProductImage`
- `Order`
- `CustomizationDesign`

## 10.6. Что делать, если порт занят

Если `npm run dev` пишет, что `3000` занят:

- не паниковать;
- смотреть, на каком порту реально стартовал Next.js;
- открыть именно этот адрес.

## 10.7. Что делать, если build падает

Последовательность:

1. `npm run typecheck`
2. `npm run lint`
3. проверить ошибки route/page/components
4. убедиться, что `.env` не содержит битых значений
5. проверить последние изменения в чувствительных файлах:
   - auth
   - cart
   - editor
   - env/config

## 10.8. Что делать, если снова всплывет UTF-8 issue

Ранее уже была ошибка вида:

- `stream did not contain valid UTF-8`
- проблема возникала в `src/app/layout.tsx`

Если это повторится:

1. проверить encoding файла;
2. пересохранить файл как UTF-8 без битых символов;
3. проверить недавние вставки из внешних источников;
4. заново прогнать build/dev.

# 11. Environment Variables and External Services

## 11.1. Основные env

Проект опирается как минимум на:

- `DATABASE_URL`
- `DIRECT_URL`
- `NODE_ENV`
- `APP_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_KEY_ID`
- `REFRESH_TOKEN_PEPPER`
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_DAYS`
- `COOKIE_DOMAIN`
- `REDIS_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CURRENCY`
- `UPLOADTHING_TOKEN`
- `UPLOADTHING_APP_ID`
- `SENTRY_DSN`
- `SENTRY_ERROR_SAMPLE_RATE`
- `SENTRY_WARNING_SAMPLE_RATE`
- `SENTRY_INFO_SAMPLE_RATE`

## 11.2. Что обязательно локально

Для локальной разработки критичны:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_KEY_ID`
- `REFRESH_TOKEN_PEPPER`
- `COOKIE_DOMAIN`
- `REDIS_URL`

Для checkout-related локального теста также желательно:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 11.3. Что обязательно для production

Production требует полного набора:

- корректный Neon connection string;
- Redis/Upstash URL;
- реальные Stripe keys;
- UploadThing creds;
- production `APP_URL`;
- production `COOKIE_DOMAIN`;
- monitoring env.

## 11.4. Внешние сервисы, которые выбраны

- Hosting: **Vercel**
- Production PostgreSQL: **Neon**
- Redis/rate limiting: **Upstash Redis**
- Uploads: **UploadThing**
- Payments: **Stripe**
- Monitoring: **Sentry** или аналог

## 11.5. Что уже начиналось

Пользователь уже:

- открывал Neon;
- создавал/настраивал проект в Neon;
- копировал connection string;
- открывал Vercel project setup;
- обсуждал выбор плана и ввод env.

## 11.6. Что пока сознательно не завершено

Deploy был временно отложен, чтобы:

- не тратить время на инфраструктуру раньше, чем стабилизирован core functionality;
- не мешать локальной разработке каталога, buyer flow и editor.

# 12. Database Structure and Data Model

## 12.1. Основные модели пользователей и auth

### `User`

Ключевая пользовательская модель.
Практически важные поля:

- `email` — unique;
- `role` — `USER` / `ADMIN`;
- `passwordHash`;
- security/2FA-related поля;
- profile/account-related поля.

### `Session`

Активные/исторические сессии пользователя.
Нужна для:

- управления безопасностью;
- logout/revoke;
- session visibility.

### `RefreshToken`

Хранение rotating refresh tokens.
Важно для secure session model.

### `BackupCode`

Поддержка 2FA backup codes.

## 12.2. Каталог

### `Category`

Категории товаров.
Важно:

- `slug` unique.

### `Product`

Основная товарная сущность.

### `ProductVariant`

Отдельные варианты товара:

- размер;
- цвет;
- SKU-like distinctions.

### `ProductImage`

Отдельное хранение изображений товара.
Это важно, потому что карточка уже поддерживает multi-image подход.

### `InventoryItem`

Запас / наличие / инвентарные элементы.

## 12.3. Корзина и избранное

### `Cart`

Корзина пользователя / гостевого сценария (через связанную логику).

### `CartItem`

Позиции корзины.

### `WishlistItem`

Позиции избранного.

## 12.4. Заказы и оплата

### `Order`

Заказ пользователя.

### `OrderItem`

Позиции заказа.

### `Payment`

Платежная сущность.

### `StripeEventLog`

Журнал Stripe webhook/event handling.

## 12.5. Кастомизация

### `CustomizationDesign`

Центральная модель для кастомного дизайна.

### `DesignAsset`

Связанные ассеты дизайна:

- изображения;
- preview-related metadata;
- upload references.

## 12.6. Контент и админка

### `ContentPost`

Контентный модуль.

### `AuditLog`

Следы административных и значимых действий.

### `AdminAction`

Дополнительная административная action/entity layer.

### Admin filter presets

В проекте есть отдельные preset-модели для admin filters:

- `AdminOrderFilterPreset`
- `AdminUserFilterPreset`
- `AdminProductFilterPreset`
- `AdminContentFilterPreset`
- `AdminLogFilterPreset`
- `AdminSessionFilterPreset`
- `AdminWebhookFilterPreset`

Это важно: админка в проекте не “игрушечная”, а построена ближе к operational UI.

## 12.7. Практические правила схемы

- `User.email` — уникален
- роли: `USER`, `ADMIN`
- цены хранятся в integer cents
- товар и варианты разделены
- изображения товара хранятся отдельно
- кастомный дизайн хранится отдельно от обычного товара
- брендовые и basic-товары существуют в одном каталожном домене, но подчиняются разным продуктовым правилам

## 12.8. Что пользователь может править руками в Prisma Studio

Относительно безопасно смотреть/редактировать вручную:

- `Product`
- `ProductVariant`
- `ProductImage`
- `Category`
- иногда `User` для отладки ролей

Лучше не править руками без причины:

- auth/session-related сущности;
- payment/order state;
- refresh tokens;
- audit-related сущности;
- design-linked записи, если не понимаешь последствия.

# 13. Authentication / Authorization / Security

## 13.1. Login / Register

Проект реализует:

- регистрацию;
- логин;
- logout;
- refresh session flow.

## 13.2. Access / Refresh model

Используется классическая безопасная схема:

- короткоживущий access token;
- refresh token rotation;
- хранение через HttpOnly cookies.

## 13.3. Cookies

Сессия доставляется через cookies, а не через `localStorage`.
Это принципиальное правило проекта.

## 13.4. Logout

Logout должен:

- завершать пользовательскую сессию;
- инвалидировать refresh/token chain где это предусмотрено;
- корректно обновлять header/UI state.

## 13.5. RBAC

Роли:

- `USER`
- `ADMIN`

Admin-only surfaces должны быть защищены.

## 13.6. Middleware

Middleware используется для:

- защиты маршрутов;
- authn/authz;
- security headers / prechecks;
- чувствительных переходов.

## 13.7. 2FA

В проекте есть контур optional 2FA:

- backup codes;
- secret-related fields;
- 2FA field в login UI.

## 13.8. CSRF

CSRF-защита заложена в архитектуре и должна сохраняться как обязательный production requirement.

## 13.9. Rate limiting

Используется / планируется через Redis-related layer.

## 13.10. Что уже ломалось и правилось

Реально уже всплывали:

- auth regressions;
- registration validation issues;
- проблемы header state после auth;
- buyer-flow fixes;
- ситуации, когда login UI “висел” или вел себя нестабильно.

Вывод:

- auth/security архитектурно заложены правильно;
- но это чувствительная зона, которую новый чат должен трогать аккуратно.

# 14. Catalog and Product Domain

## 14.1. Что уже есть

- каталог;
- бренды;
- basics;
- product page;
- related products;
- карточки;
- фильтры;
- product gallery.

## 14.2. Basics vs branded catalog

Новый чат обязан помнить:

- branded items идут в обычную покупку;
- basic items могут быть связаны с editor flow.

## 14.3. Product gallery

Была отдельная доработка gallery/multi-image support.
Карточка уже должна поддерживать несколько фото.
Пользователь отдельно хотел, чтобы в карточке товара было **3 изображения**.

## 14.4. Правила наполнения товаров

Для хорошего состояния каталога каждый товар должен иметь:

- название;
- бренд;
- описание;
- цену;
- материал;
- размеры;
- цвета / варианты;
- наличие;
- минимум 3 изображения.

## 14.5. Что пользователь может делать параллельно

Пользователь уже готов:

- сам добавлять вещи;
- сам добавлять фото;
- сам заполнять часть контента.

Новый чат не должен мешать этому процессу.

# 15. Cart / Wishlist / Buyer Flow

## 15.1. Корзина

В проекте есть:

- guest cart;
- authenticated cart;
- UI корзины;
- buyer actions around line items.

## 15.2. Главный чувствительный сценарий

Ключевое требование пользователя:

- **товары гостя не должны пропадать после логина**

Следовательно:

- merge guest cart -> account cart является high-priority зоной.

## 15.3. Wishlist

Wishlist реализован и визуально присутствует.
Нужно сохранить:

- add/remove behavior;
- persistence behavior;
- header/page coherence.

## 15.4. Что нельзя ломать

Новый чат не должен случайно разрушить:

- cart state после auth;
- basics/custom item continuity;
- add-to-cart flow на product page;
- wishlist toggles.

# 16. Checkout / Orders / Payments

## 16.1. Что уже есть

- checkout pages/flow foundation;
- order-related entities;
- service layer for checkout;
- Stripe-oriented architecture;
- recovery/cancel-related work уже велась.

## 16.2. Целевой сценарий

Пользователь должен иметь возможность:

1. добавить branded/basic/custom item в корзину;
2. перейти в checkout;
3. получить Stripe checkout session;
4. оплатить заказ;
5. увидеть заказ в профиле.

## 16.3. Что еще не считается финально закрытым

- реальные Stripe keys;
- webhook verification в production;
- post-payment order finalization;
- full smoke-test order appearance in profile.

## 16.4. Почему это нельзя считать “мелочью”

Даже если код checkout уже написан, для 100% готовности нужно:

- реальные env;
- реальные Stripe callbacks;
- проверка order status transitions;
- проверка пользовательского опыта после оплаты.

# 17. Profile / User Account

## 17.1. Что уже есть

- profile page;
- security section;
- order history block;
- user identity shown in UI;
- header state for logged-in users.

## 17.2. Что уже исправлялось

- раньше после auth шапка могла вести себя неправильно;
- это уже дорабатывалось;
- текущая логика должна сохранять корректное состояние “вошел / не вошел”.

## 17.3. Что еще нужно проверить

- появление заказов после checkout;
- корректность security/actions;
- consistency между login/register/profile flows.

# 18. Admin Panel

## 18.1. Сильная сторона проекта

Админка — одна из самых сильных частей проекта по визуальному и архитектурному впечатлению.

## 18.2. Что уже есть

- dashboard;
- users management;
- products management;
- orders management;
- content management;
- sessions;
- logs;
- settings;
- webhooks;
- backups / operational surfaces.

## 18.3. Почему это важно

Для диплома и демонстрации это сильно повышает вес проекта:

- проект выглядит не как просто витрина;
- у него есть управленческий и operational слой;
- это ближе к реальному production-приложению.

## 18.4. Честный статус

- визуально и архитектурно админка уже сильна;
- часть функций может требовать финальной production-полировки;
- но административный контур проекта уже реален и содержателен.

# 19. 2D Editor / Customizer

## 19.1. Что уже реализовано

- Fabric.js-based canvas/editor;
- шаблоны одежды;
- работа с текстом;
- добавление изображений;
- выбор цвета;
- front/back логика;
- сохранение дизайна;
- связи с basics flow;
- базовая интеграция с cart-потоком.

## 19.2. Что в проекте уже подтверждено пользователем визуально

Пользователь многократно:

- открывал editor;
- оценивал макеты;
- просил улучшить front/back;
- просил улучшить подвижность зон;
- просил улучшить шаблоны и цвет.

## 19.3. Основные проблемные места

- качество шаблонов одежды;
- printable zones;
- положение шаблонов внутри канваса;
- чистота визуального слоя;
- grid behavior;
- layer behavior;
- UX control panel;
- mobile behavior;
- undo/redo;
- гибкость текстовых зон;
- color application quality.

## 19.4. Стратегическое решение

Очень важно:

- 2D editor — обязательная фишка проекта;
- но его **глубокая финальная полировка отложена**;
- сначала нужно довести:
  - core commerce flow;
  - checkout;
  - deploy readiness;
  - production infra.

Новый чат не должен уходить в бесконечное “улучшим макет футболки”, пока не закрыты критичные commerce/deploy задачи.

# 20. Content / Legal / Service Pages

## 20.1. Что уже есть

В `src/app` уже существуют маршруты:

- `delivery`
- `returns`
- `contacts`
- `privacy`
- `terms`
- `offer`

## 20.2. Что еще нужно

Нужно финализировать текстовую и production-ready часть:

- доставка;
- возврат;
- контакты;
- политика конфиденциальности;
- пользовательское соглашение;
- публичная оферта.

## 20.3. Почему это важно

Для публичного сайта это обязательные страницы.
Технически они не самые сложные, но для полной готовности проекта они нужны.

# 21. Deployment Readiness

## 21.1. Выбранный production stack

- Hosting: **Vercel**
- DB: **Neon PostgreSQL**
- Redis: **Upstash Redis**
- Uploads: **UploadThing**
- Payments: **Stripe**

## 21.2. Что уже есть в репозитории

Уже есть deploy-ориентированные документы:

- `docs/vercel-deployment.md`
- `docs/db-migration-runbook.md`
- `docs/release-checklist.md`
- `docs/production-finalization-roadmap.md`
- `docs/production-readiness-status.md`

## 21.3. Что пользователь уже делал

Пользователь уже:

- открывал Vercel New Project flow;
- открывал Neon project setup;
- выбирал Free/Hobby-пути;
- копировал connection string;
- обсуждал env mapping.

## 21.4. Что пока не завершено

- полное заполнение production env;
- привязка всех внешних сервисов;
- first successful production deploy;
- production smoke test.

## 21.5. Почему деплой откладывался

Решение было сознательное:

- сначала стабилизировать ядро магазина;
- потом делать production wiring.

# 22. Monitoring / Logs / Stability

## 22.1. Что требуется

Для production readiness нужны:

- application logs;
- error monitoring;
- backup verification;
- Stripe event tracking;
- upload error tracking;
- observability around runtime failures.

## 22.2. Что уже под это подготовлено

- в проекте есть logger layer;
- в админке и ops-экранах уже есть предпосылки для operational visibility;
- docs уже предполагают monitoring and final readiness checks.

## 22.3. Почему stability — это отдельный фронт работы

В процессе разработки уже возникали:

- build breaks;
- runtime breaks;
- style/render issues;
- env/runtime inconsistencies.

Поэтому перед production deploy stability должна считаться отдельным обязательным этапом.

# 23. Known Bugs / Repeated Issues / Pitfalls

## 23.1. GitHub merge / PR conflicts

У пользователя регулярно возникали:

- merge conflicts;
- out-of-date branches;
- проблемы squash/merge в UI;
- необходимость делать `Update branch`.

Если всплывет снова:

- сначала смотреть PR state;
- потом актуализировать ветку относительно `develop`.

## 23.2. Vim / Git editor confusion

Пользователь несколько раз попадал в Vim/Git merge message editor и путался.

Если снова случится:

- лучше давать четкие non-interactive git-команды;
- избегать сценариев, где нужен интерактивный редактор.

## 23.3. Build errors

Уже были реальные build errors:

- syntax errors;
- broken route/page files;
- invalid encoding issues.

## 23.4. UTF-8 issue

Уже была ошибка:

- `stream did not contain valid UTF-8`

Связано было с `src/app/layout.tsx`.

Если повторится:

- проверить encoding;
- пересохранить файл в UTF-8.

## 23.5. Auth regressions

Были:

- логин, который зависал;
- ошибки регистрации;
- неясные ошибки валидации;
- некорректный header-state.

## 23.6. Registration validation issues

Исправлялись password rules и UX-подсказки.
Эту часть нельзя ломать без необходимости.

## 23.7. Broken styles / page without CSS

Пользователь уже видел ситуацию, когда сайт рендерился “как голый HTML без стилей”.
Если это повторится:

- проверить глобальные стили;
- проверить build/runtime;
- проверить не сломался ли app shell.

## 23.8. Port confusion 3000/3001

Это уже происходило.
Нужно всегда смотреть, на каком порту реально поднялся `next dev`.

## 23.9. Editor template/grid issues

Регулярные претензии пользователя:

- кривые шаблоны;
- лишние линии/сетка;
- плохая printable-zone;
- неудобные text controls.

Это ожидаемо, но не первоочередно по сравнению с core store flow.

## 23.10. Early CI / prepare database / branch protection issues

На более ранних этапах были:

- CI failures;
- prepare database failures;
- branch protection quirks.

Сейчас это уже во многом стабилизировано, но история важна.

# 24. User Workflow and Communication Preferences

## 24.1. Язык

Пользователь общается **по-русски**.

## 24.2. Формат инструкций

Пользователь предпочитает:

- пошаговые инструкции;
- конкретные команды блоком;
- прямые объяснения “что нажать / что сделать сейчас”.

## 24.3. Формат статуса

Пользователю важно регулярно понимать:

- что уже сделано;
- что осталось;
- на каком этапе проект;
- что делать дальше.

## 24.4. Практический стиль лучше абстрактного

Для кода и проекта лучше:

- технический;
- прикладной;
- структурный;
- без лишней абстракции.

## 24.5. Дипломный контекст

Когда речь про диплом:

- стиль должен быть официальный;
- текст должен быть формальным.

Когда речь про код/разработку:

- нужен инженерный и понятный стиль.

## 24.6. Что пользователь делает сам

Пользователь активно участвует руками:

- добавляет товары;
- загружает фото;
- делает PR;
- мерджит ветки;
- запускает Docker;
- открывает Prisma Studio;
- делает скриншоты;
- подготавливает материалы для диплома;
- проходит шаги в Neon/Vercel, если есть инструкция.

# 25. What the User Can Do in Parallel

## 25.1. Безопасно делать параллельно

Пользователь может параллельно:

- добавлять товары;
- добавлять по 3 фото на товар;
- заполнять бренд, описание, размеры, цену, материал;
- готовить скриншоты интерфейса для диплома;
- собирать диаграммы вручную;
- искать и фиксировать аналоги;
- тестировать UI руками;
- проходить простые шаги в Neon/Vercel по инструкции.

## 25.2. Что делать параллельно рискованно

Не стоит без координации:

- вручную править критичную auth-логику;
- вручную переписывать checkout/cart/editor core logic;
- делать merge конфликтных веток, не понимая состояния ветки;
- хаотично редактировать env/config/security файлы.

# 26. Exact Current Stop Point

Проект сейчас находится в следующей точке:

- сайт уже **локально продвинутый и демо-готовый**;
- основной магазин в значительной степени собран;
- каталог, карточка товара, auth, профиль, корзина, админка и базовый 2D Lab уже существуют;
- пользователь параллельно готовил дипломные материалы и уже использовал проект для демонстрации;
- каталог еще продолжает наполняться товарами и фото;
- production deploy и production infra еще не доведены до конца;
- 2D editor работает, но не считается финально отполированным;
- текущее стратегическое решение: **не начинать с полного redesign editor UX**, пока не закрыты:
  - stability;
  - buyer flow;
  - checkout/orders/profile consistency;
  - deploy readiness.

Если новый чат продолжает проект:

- не надо первым делом уходить в бесконечное улучшение editor шаблонов;
- сначала нужно завершить core eCommerce и production readiness.

# 27. Priority Roadmap to 100% Readiness

## 27.1. Приоритетный порядок

1. **Стабильность локального runtime/dev/build**
2. **Buyer flow / cart / auth-state consistency**
3. **Checkout / orders / profile history**
4. **Наполнение каталога контентом**
5. **Production infrastructure wiring**
6. **Security / monitoring / backups**
7. **Final smoke test**
8. **Финальная глубокая полировка 2D editor**

## 27.2. Почему именно так

### 1. Стабильность dev/build

Если локальная среда нестабильна, любые следующие работы становятся дорогими и хаотичными.

### 2. Buyer flow / cart / auth-state

Пользователь не должен терять товары, ломать корзину или упираться в auth inconsistencies.
Это основа магазина.

### 3. Checkout / orders / profile history

Пока заказ не проходит от корзины до профиля, магазин не считается завершенным.

### 4. Наполнение каталога

Контент нужен для полноценного вида магазина, но бессмысленно идеально наполнять каталог до стабилизации checkout ядра.

### 5. Production infrastructure wiring

После стабилизации функционального ядра можно безопасно подключать Vercel, Neon, Redis, Stripe, UploadThing.

### 6. Security / monitoring / backups

Это нужно перед реальным публичным запуском, а не в виде “когда-нибудь потом”.

### 7. Final smoke test

Только после этого можно честно считать сайт почти production-ready.

### 8. Final 2D editor polish

Editor важен, но он не должен съесть весь проект до того, как магазин стабилен.

# 28. Safe Next Actions for the New Chat

## 28.1. Безопасный порядок старта

Новый чат должен действовать так:

1. Проверить, что проект локально запускается.
2. Проверить `register -> login -> profile`.
3. Проверить `cart -> wishlist -> post-login cart continuity`.
4. Проверить `checkout -> order creation -> order visibility in profile`.
5. После этого переходить к deploy readiness.
6. И только после стабилизации core flow идти в глубокую полировку `2D Lab`.

## 28.2. Do not start with X. Start with Y.

**Do not start with:**

- полный redesign 2D editor;
- массовая переделка UI;
- случайная миграция всего deployment stack без проверки core flows.

**Start with:**

- локальная стабильность;
- auth/cart/buyer flow;
- checkout/order consistency;
- затем infra wiring;
- затем final polish editor.

## 28.3. Самый безопасный первый практический шаг

Если новый чат включается в проект прямо сейчас, самый безопасный старт:

1. Запустить проект локально.
2. Проверить текущий auth flow.
3. Проверить cart merge после логина.
4. Проверить checkout path.
5. Только потом решать, какой следующий незакрытый блок брать в работу.

---

## Appendix A. Current Observed Git Context

На момент подготовки этого handoff локально было зафиксировано:

- ветка: `develop`
- локальная ветка впереди `origin/develop` на 12 коммитов
- в рабочем дереве были локальные пользовательские изменения в чувствительных файлах:
  - `src/app/cart/page.tsx`
  - `src/app/login/page.tsx`
  - `src/app/register/page.tsx`
  - `src/config/customizer.ts`
  - `src/config/env.ts`
  - `src/features/editor/components/editor-canvas.tsx`
  - `src/hooks/use-auth.ts`
  - `src/hooks/use-cart.ts`
  - `src/lib/guest-cart-merge.ts`
  - `src/store/guest-cart-store.ts`

Новый чат должен учитывать это и не делать агрессивных действий вроде жестких reset/revert без явного запроса пользователя.

## Appendix B. Important Existing Documentation

Полезные документы в репозитории:

- `C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\docs\release-checklist.md`
- `C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\docs\db-migration-runbook.md`
- `C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\docs\vercel-deployment.md`
- `C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\docs\production-finalization-roadmap.md`
- `C:\Users\rs998\Documents\Codex\2026-05-14\principal-full-stack-engineer-solution-architect\docs\production-readiness-status.md`

## Appendix C. Short Project Truth Statement

RSH — это уже не черновик и не учебный CRUD.
Это продвинутый локально работающий интернет-магазин одежды с админкой, авторизацией, каталогом, корзиной, профилем и отдельным 2D Lab для `RSH BASICS`.
Но это еще не полностью production-ready публичный магазин.
Следующий чат должен не “изобретать проект заново”, а безопасно довести существующую систему до 100% готовности через стабилизацию core commerce flow, инфраструктуры и только потом — финальную полировку кастомайзера.
