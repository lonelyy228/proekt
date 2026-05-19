# Database Migration and Rollback Runbook

## Scope

This runbook defines the safe production flow for Prisma migrations in RSH and a rollback strategy using restore/forward-fix principles.

## 1. Pre-Deploy Checklist

1. Ensure CI passed (`typecheck`, `lint`, `test`, `build`, `test:e2e:security`, `test:e2e:smoke`).
2. Verify all migration files are committed in `prisma/migrations`.
3. Run DB preflight locally or in CI:
   - `npm run db:preflight`
4. Confirm production secrets are valid (`NODE_ENV=production`, HTTPS `APP_URL`, non-localhost `COOKIE_DOMAIN`, live Stripe key, UploadThing secrets).

## 2. Deploy Migrations

1. Generate Prisma client:
   - `npm run prisma:generate`
2. Apply pending migrations:
   - `npm run prisma:deploy`
3. Validate migration status:
   - `npm run db:preflight`

### Baseline note for existing non-empty DBs

If `prisma migrate deploy` fails with `P3005` on an existing schema without migration history, baseline first:

1. Confirm the schema matches current code (`npx prisma db pull` and review).
2. Mark the initial migration as applied:
   - `npx prisma migrate resolve --applied <initial_migration_folder_name>`
3. Re-run:
   - `npm run prisma:deploy`
   - `npm run db:preflight`

## 3. Post-Migration Verification

1. Validate app health endpoints and critical APIs.
2. Run targeted smoke checks:
   - `npm run test:e2e:security`
   - `npm run test:e2e:smoke`
3. Check admin dashboards and error monitoring for regressions.

## 4. Rollback Strategy (Production)

Use **restore + redeploy** or **forward-fix**. Do not manually edit production tables ad-hoc.

### A. Preferred: Point-in-time restore

1. Trigger restore in DB provider (Neon/Vercel Postgres) to a safe timestamp.
2. Re-point runtime `DATABASE_URL`/`DIRECT_URL` to restored instance.
3. Re-run deploy verification:
   - `npm run db:preflight`
   - `npm run test:e2e:security`
   - `npm run test:e2e:smoke`

### B. Forward-fix migration

1. Create corrective migration in git (`prisma migrate dev`).
2. Review SQL with DBA/owner.
3. Deploy via standard pipeline (`prisma migrate deploy`).

## 5. Emergency Guardrails

1. Freeze admin mutations if data integrity is uncertain.
2. Disable risky jobs/webhook replays until DB state is confirmed.
3. Record incident timeline and recovery commands in release notes.

## 6. Ownership

- Release owner: executes migration commands.
- Reviewer: validates migration SQL and rollback path.
- On-call: confirms post-deploy and rollback signals.
