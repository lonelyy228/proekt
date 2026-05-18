# Apparel Forge

Production-grade Next.js 14 modular monolith for apparel eCommerce with secure auth, Stripe checkout, admin panel, and Fabric.js-based 2D customizer.

## Stack

- Next.js 14 App Router + React 18 + TypeScript strict
- PostgreSQL + Prisma
- Zod validation + service/repository architecture
- JWT access + rotating refresh tokens in HttpOnly cookies
- Stripe Checkout + webhook processing
- Fabric.js editor persisting Fabric JSON + preview URL metadata

## Quick Start

1. Install dependencies:
   - `npm install`
2. Configure env:
   - Copy `.env.example` to `.env`
3. Start local infrastructure:
   - `docker compose up -d`
4. Generate prisma client and sync DB schema:
   - `npm run prisma:generate`
   - `npx prisma db push`
5. Seed initial data:
   - `npm run seed`
6. Run app:
   - `npm run dev`

## Quality Gates

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm run test`
- Build: `npm run build`

## Architecture

- `src/app` - pages + route handlers
- `src/server/services` - business rules
- `src/server/repositories` - data access
- `src/server/validators` - Zod schemas
- `src/server/utils` - security/shared utilities
- `src/store` - Zustand guest cart
- `src/lib` - Prisma, Stripe, logger, upload adapters

## Security Notes

- Access/refresh tokens are cookie-based and never stored in localStorage.
- Refresh token rotation with family revocation on reuse.
- CSRF protection for state-changing actions.
- RBAC and middleware route protection.
- Money stored as integer cents.
