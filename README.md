# Mini ERP + CRM Operations Portal

A wholesale/distribution operations portal: customers (CRM), products &
inventory, and sales challans with transactional stock control. Built as a
Bun + Turborepo monorepo — Next.js frontend, Hono backend on Bun, PostgreSQL
via Drizzle ORM, and Cloudflare R2 for product images.

See [`prompt.md`](./prompt.md) for the full build blueprint this project was
generated from (schema design, API surface, business rules, design direction).

## Stack

- **Monorepo**: Turborepo + Bun workspaces
- **Backend**: Bun + Hono + TypeScript, Drizzle ORM, PostgreSQL, Zod validation, JWT auth
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, TypeScript
- **Storage**: Cloudflare R2 (S3-compatible) for product images
- **PDF export**: `@react-pdf/renderer` for challan/invoice export
- **Infra**: Docker Compose (local), GitHub Actions (CI + deploy)

## Project structure

```
apps/
  api/     Bun + Hono backend
  web/     Next.js frontend
packages/
  db/      Drizzle schema, migrations, seed script
  types/   Shared Zod schemas (single source of truth for validation)
  config/  Shared tsconfig
```

## 1. Local setup

### Prerequisites
- [Bun](https://bun.sh) 1.1+
- Docker (for local Postgres) — or your own Postgres instance
- A Cloudflare R2 bucket (optional locally — only needed for image upload)

### Install & configure

```bash
git clone <this-repo>
cd erp-crm
bun install
cp .env.example .env   # fill in real values, especially JWT secrets and R2 creds
```

### Start the database

```bash
bun run db:up          # docker compose up -d postgres
bun run db:generate    # generate SQL migrations from packages/db/src/schema.ts
bun run db:migrate     # apply migrations
bun run db:seed        # seed 4 role-based users, sample customers/products/challans
```

### Run the app

```bash
bun run dev             # runs apps/api (port 4000) and apps/web (port 3000) via turbo
```

Visit `http://localhost:3000`. Sign in with any seeded account:

| Role      | Email               | Password   |
|-----------|---------------------|------------|
| Admin     | admin@erp.test       | Passw0rd!  |
| Sales     | sales@erp.test       | Passw0rd!  |
| Warehouse | warehouse@erp.test   | Passw0rd!  |
| Accounts  | accounts@erp.test    | Passw0rd!  |

## 2. Environment variables

See `.env.example` at the repo root — copy it to `.env` for Docker Compose,
and/or `apps/api/.env` + `apps/web/.env.local` if running the apps outside
Docker. Key variables:

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api, db package | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | api | Rotate these for production |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | api | From your Cloudflare R2 dashboard → Manage API Tokens |
| `CORS_ORIGIN` | api | Set to your deployed frontend URL in production |
| `NEXT_PUBLIC_API_URL` | web | Public API base URL, e.g. `https://api.yourapp.com/api/v1` |

## 3. Running with Docker

```bash
cp .env.example .env    # fill in real secrets
docker compose up --build
```

This brings up Postgres, the API (port 4000), and the web app (port 3000).
Run migrations/seed once the containers are healthy:

```bash
docker compose exec api bun run --cwd ../../packages/db migrate
docker compose exec api bun run --cwd ../../packages/db seed
```

## 4. Deployment (free-tier)

- **Frontend → Vercel**: import the repo, set the root directory to
  `apps/web`, add `NEXT_PUBLIC_API_URL` pointing at your deployed backend.
- **Backend → Railway / Fly.io / Render**: deploy `apps/api` (Dockerfile
  provided). Add all backend env vars from `.env.example`. Point
  `DATABASE_URL` at your hosted Postgres.
- **Database → Neon / Supabase / Railway Postgres**: create a free instance,
  run `bun run db:migrate && bun run db:seed` against it (set `DATABASE_URL`
  to the hosted connection string first).
- **R2**: create a bucket in the Cloudflare dashboard, create an API token
  scoped to that bucket, enable public access (or use a custom domain) for
  `R2_PUBLIC_URL`.
- `.github/workflows/deploy.yml` is a starting point for automating this via
  Vercel + Railway CLIs — wire your own repo secrets
  (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`) to use it.

AWS deployment (App Runner / ECS / RDS) is not included by default per the
brief's own guidance that it's optional/bonus — the Docker images work
unmodified on any container host, including AWS, if you'd rather deploy there.

## 5. Architecture notes

- **Validation is shared**: every Zod schema lives in `packages/types` and is
  imported by both the API (server-side validation) and the frontend
  (client-side form validation) — no duplicated, drifting validation logic.
- **Stock integrity is transactional, not optimistic**: confirming a challan
  row-locks every referenced product (`SELECT ... FOR UPDATE`) inside a single
  DB transaction, checks all line items before changing anything, and aborts
  the whole confirmation if any single item is short on stock. See
  `apps/api/src/modules/challans/service.ts`.
- **Challans snapshot product data** (name, SKU, price) at creation time so
  historical challans stay accurate even if a product is later renamed or
  repriced.
- **RBAC is enforced server-side** via `requireRole()` middleware on every
  mutating route; the frontend nav/actions mirror the same role matrix purely
  for UX (hiding actions a role can't perform) — the API is the actual
  authority.
- **R2 uploads are presigned**: the backend never proxies image bytes; it
  issues a short-lived presigned PUT URL and the browser uploads directly to
  R2, then confirms the final URL back to the API.

## 6. Known limitations / not yet implemented

This is a from-scratch scaffold generated end-to-end in one pass. Everything
listed in `prompt.md` §12 is scaffolded and the core flows (auth, RBAC,
customers, products + stock movements, the transactional challan
confirm/cancel logic, PDF export, R2 presigned upload) are implemented and
wired between frontend and backend. Before treating this as submission-ready,
still do the following:

- **Install dependencies and run it locally once** (`bun install`, migrate,
  seed) — this environment could not run a live Bun/Docker/Postgres process,
  so the code has not been executed end-to-end here. Review for typos/import
  issues on first run.
- **Frontend image upload UI** for products isn't wired to the presigned R2
  flow yet (the API endpoints exist: `POST /products/:id/image-upload-url`,
  `PATCH /products/:id/image` — the product detail page needs an upload
  widget calling them).
- **Draft challan editing UI** (`PATCH /challans/:id`) — the API supports
  editing a draft's items; the frontend challan detail page currently only
  exposes confirm/cancel/export, not an edit form.
- **Pagination controls** in the frontend list pages fetch up to 50/100 rows
  but don't yet render page-forward/back controls — the API's `meta` object
  already supports it.
- **User management UI** for admins (the API's RBAC assumes users already
  exist via the seed script; there's no `/users` CRUD module yet — add one
  following the same module pattern as customers/products if needed).
- **Automated tests** in `apps/api/test/challan.test.ts` are written as
  `test.todo(...)` specs describing exactly what to assert — they need real
  DB setup/teardown wiring to run in CI.
- **GST invoice numbering/format** is a plain PDF challan export, not a
  statutory GST invoice — adapt `apps/api/src/modules/challans/pdf.ts` if
  formal GST-compliant invoicing is required.

## 7. Bonus features included

- ✅ Docker Compose (Postgres + API + web)
- ✅ GitHub Actions CI (lint, typecheck, test, build) + a deploy workflow starting point
- ✅ PDF challan/invoice export (`GET /challans/:id/pdf`)
- ✅ Cloudflare R2 image upload (presigned URL flow, in place of AWS S3)
