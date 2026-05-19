# Production Release Checklist

## 1. Environment and Secrets

- Verify `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `APP_URL`, `COOKIE_DOMAIN`.
- Verify auth secrets and rotation values:
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `JWT_KEY_ID`
  - `REFRESH_TOKEN_PEPPER`
- Verify payment and upload secrets:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `UPLOADTHING_TOKEN`
  - `UPLOADTHING_APP_ID`
- Confirm `NODE_ENV=production` in runtime.

## 2. Database and Migrations

- Run `npm run prisma:generate`.
- Run `npm run prisma:deploy`.
- Run `npm run db:preflight`.
- Confirm schema consistency in production DB.
- Confirm seed data policy (do not run destructive seed in production).

## 3. Security Controls

- Confirm secure cookie policy on target domain:
  - `HttpOnly`
  - `Secure`
  - `SameSite=Strict`
- Confirm CSRF protection for state-changing endpoints.
- Confirm RBAC on `/api/admin/*` and `/admin/*`.
- Confirm rate limits for auth, admin mutations, checkout, uploads.
- Confirm no auth/session tokens in `localStorage`.

## 4. Upload and Customizer Safety

- Confirm only PNG/JPEG/WEBP are accepted for design assets.
- Confirm object storage is used for editor assets and preview files.
- Confirm design payload validation:
  - trusted HTTPS asset hosts only
  - max object count
  - max preview dimensions/pixels
- Confirm `/api/designs` rejects untrusted preview/object URLs.

## 5. Payments and Webhooks

- Confirm Stripe checkout creates idempotent sessions.
- Confirm webhook signature validation is active.
- Confirm webhook idempotency and replay safety.
- Run webhook smoke with test mode events.

## 6. Quality Gates

- Recommended one-command preflight:
  - `npm run release:verify`
- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run test`.
- Run targeted e2e smoke:
  - `npm run test:e2e:smoke` (or individual specs)

## 7. Post-Deploy Verification

- Login/logout/refresh session flow works.
- Catalog, filters, product page, cart, wishlist work.
- Checkout session creation works.
- Admin pages (`users/products/orders/content/logs/settings/backups`) load and mutate safely.
- Customizer saves design JSON and trusted preview URL.
- Error monitoring receives test event (if Sentry is enabled).

## 8. Rollback Readiness

- Verify DB backup/PITR availability in provider console.
- Follow rollback procedure in `docs/db-migration-runbook.md`.
- Verify restore runbook and owner on-call handoff.
- Verify latest deployment tag and rollback command path in CI/CD.
