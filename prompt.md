# Mini ERP + CRM Operations Portal — Master Build Prompt

This document is the single source of truth for building this project end to end.
It is written to be handed to a developer (human or AI coding agent, e.g. Claude Code)
and followed top to bottom. Do not skip sections — later modules depend on earlier
decisions (schema, auth, monorepo layout).

---

## 0. Tech Stack (locked)

| Layer            | Choice                                                              |
|-------------------|----------------------------------------------------------------------|
| Monorepo          | Turborepo + Bun workspaces                                          |
| Runtime            | Bun (backend + tooling), Node-compatible where required             |
| Backend framework  | Hono (runs natively on Bun, fast, first-class TS, middleware model similar to Express) |
| Language           | TypeScript everywhere, strict mode                                  |
| Database           | PostgreSQL 15+                                                      |
| ORM                | Drizzle ORM + drizzle-kit migrations                                |
| Validation         | Zod (shared schemas between frontend/backend via `packages/types`)  |
| Auth               | JWT (access + refresh), bcrypt password hashing, RBAC middleware    |
| Frontend           | Next.js 14+ (App Router), React, TypeScript                          |
| Styling            | Tailwind CSS + shadcn/ui primitives                                 |
| Object storage     | Cloudflare R2 (S3-compatible API via `@aws-sdk/client-s3`)           |
| PDF generation      | `@react-pdf/renderer` (invoice/challan PDF export)                  |
| Containerization    | Docker + docker-compose (postgres, api, web)                        |
| CI/CD               | GitHub Actions (lint, typecheck, test, build, deploy)                |
| Hosting (free tier) | Frontend → Vercel. Backend → Railway/Fly.io/Render. DB → Neon/Supabase/Railway Postgres. R2 → Cloudflare (free tier, 10GB). |

**Why Hono, not Express/Nest:** Bun + Hono gives native Bun performance, minimal
overhead, and Express-like ergonomics (`app.get`, middleware chain) which satisfies
the assignment's "Express.js or NestJS" requirement in spirit while matching the
Bun-first stack the team wants. If a strict Express requirement is non-negotiable,
swap `apps/api` to Express — the route/service/repository layering below stays
identical either way.

---

## 1. Monorepo Layout

```
erp-crm/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # Bun + Hono backend
├── packages/
│   ├── db/                   # Drizzle schema, migrations, seed scripts
│   ├── types/                # Shared Zod schemas + inferred TS types
│   └── config/                # Shared eslint/tsconfig/tailwind config
├── docker-compose.yml
├── turbo.json
├── package.json               # bun workspaces root
├── .github/workflows/ci.yml
├── postman/
│   └── erp-crm.postman_collection.json
├── prompt.md                  # this file
└── README.md
```

`package.json` workspaces: `["apps/*", "packages/*"]`. `turbo.json` defines
pipelines for `dev`, `build`, `lint`, `typecheck`, `test`, wired so `bun run dev`
at the root boots both `api` and `web` concurrently with the DB.

---

## 2. Database Schema (Drizzle) — `packages/db/schema.ts`

Design every table with `created_at` / `updated_at` timestamps, UUID primary keys
(`gen_random_uuid()`), and foreign keys with `onDelete: 'restrict'` unless noted.

### `users`
- id (uuid, pk)
- name, email (unique), password_hash
- role: enum `admin | sales | warehouse | accounts`
- is_active (bool, default true)
- created_at

### `customers`
- id (uuid, pk)
- name, mobile, email (nullable)
- business_name
- gst_number (nullable)
- customer_type: enum `retail | wholesale | distributor`
- address (text)
- status: enum `lead | active | inactive`
- follow_up_date (date, nullable)
- created_by (fk → users)
- created_at, updated_at

### `customer_notes` (follow-up notes, one-to-many)
- id, customer_id (fk), note (text), created_by (fk → users), created_at

### `products`
- id (uuid, pk)
- name, sku (unique), category
- unit_price (numeric(12,2))
- current_stock (integer, default 0, **never allow negative — enforce in service layer with a transaction + row lock, not just a CHECK constraint, so we can return a clean API error**)
- min_stock_alert (integer, default 0)
- location (text) — warehouse/bin location
- image_url (text, nullable) — Cloudflare R2 object URL
- created_at, updated_at

### `stock_movements`
- id, product_id (fk)
- quantity_changed (integer)
- movement_type: enum `IN | OUT`
- reason (text) — e.g. "Purchase Order #12", "Sales Challan #45", "Manual Adjustment"
- reference_type (text, nullable) — 'challan' | 'manual' | 'purchase'
- reference_id (uuid, nullable)
- created_by (fk → users)
- created_at

### `challans`
- id, challan_number (unique, auto-generated e.g. `CH-2026-0001`)
- customer_id (fk → customers)
- status: enum `draft | confirmed | cancelled`
- total_quantity (integer)
- created_by (fk → users)
- created_at, confirmed_at (nullable)

### `challan_items`
- id, challan_id (fk)
- product_id (fk → products)
- **snapshot fields** (do not join to live product for historical accuracy): `product_name`, `product_sku`, `unit_price`
- quantity (integer)

Generate the migration with `drizzle-kit generate`, apply with a `bun run db:migrate`
script. Ship a `packages/db/seed.ts` that creates one user per role
(`admin@erp.test / Passw0rd!`, `sales@erp.test / Passw0rd!`, etc.), 5 sample
customers, 10 sample products with varied stock levels, and 2 sample challans.

---

## 3. Auth & RBAC

- `POST /auth/login` — email + password → verify bcrypt hash → issue short-lived
  access JWT (15 min) + longer refresh JWT (7 days, httpOnly cookie).
- `POST /auth/refresh` — rotate access token from refresh cookie.
- `POST /auth/logout` — clear refresh cookie.
- `GET /auth/me` — return current user from access token.
- Middleware `requireAuth` — verifies JWT, attaches `user` to context.
- Middleware `requireRole(...roles)` — 403 if `user.role` not in allowed list.

**Role matrix (enforce server-side, mirror in frontend nav/guards):**

| Action                          | Admin | Sales | Warehouse | Accounts |
|----------------------------------|:---:|:---:|:---:|:---:|
| Manage users                     | ✅ | ❌ | ❌ | ❌ |
| Customers CRUD                   | ✅ | ✅ | 👁 read | 👁 read |
| Products CRUD                    | ✅ | 👁 read | ✅ | 👁 read |
| Stock movement (manual adjust)   | ✅ | ❌ | ✅ | 👁 read |
| Create/edit challan (draft)      | ✅ | ✅ | ❌ | 👁 read |
| Confirm challan (reduces stock)  | ✅ | ✅ | 👁 read | 👁 read |
| Cancel challan                   | ✅ | ✅ | ❌ | ❌ |
| Export invoice PDF               | ✅ | ✅ | ❌ | ✅ |

---

## 4. Core Business Logic — Sales Challan Stock Rules

This is the module the assignment weighs most heavily. Implement it as a single
DB transaction in `apps/api/src/modules/challans/service.ts`:

1. `createChallan` (status=draft): validate customer exists, validate each
   product exists, snapshot `product_name/sku/unit_price` onto each
   `challan_item`. No stock change on draft.
2. `updateChallan`: only allowed while `status = draft`.
3. `confirmChallan`:
   - Open a DB transaction.
   - `SELECT ... FOR UPDATE` each product row referenced (row-level lock to
     prevent race conditions under concurrent confirms).
   - For each item, verify `current_stock >= quantity`. If any item fails,
     **abort the whole transaction** and return `409 Conflict` with a payload
     listing exactly which SKUs are short and by how much — never partially
     confirm.
   - Decrement `current_stock`, insert a `stock_movements` row
     (`type=OUT, reason='Sales Challan CH-xxxx'`) per item.
   - Set `challan.status = confirmed`, `confirmed_at = now()`.
   - Commit.
4. `cancelChallan`:
   - If the challan was `confirmed`, reverse the stock (insert compensating
     `IN` stock movements) inside a transaction, then set `status = cancelled`.
   - If it was still `draft`, just mark cancelled — no stock impact.
5. Challan number generation: `CH-<year>-<zero-padded-sequence>`, generated via
   a DB sequence or `SELECT COUNT(*)+1 FOR UPDATE` inside the create
   transaction to avoid collisions.

Write integration tests (Bun test runner) specifically for: confirming with
sufficient stock, confirming with insufficient stock (expect 409, expect no
partial stock change), two concurrent confirms racing for the last unit of
stock (only one should succeed), and cancel-after-confirm restoring stock.

---

## 5. REST API Surface

All routes prefixed `/api/v1`. Every list endpoint supports `?page=&limit=`
pagination and relevant `?search=` / filter query params. Every mutating route
validates its body with a Zod schema from `packages/types` and returns
structured errors: `{ error: { code, message, fields? } }`.

```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /customers            ?search=&status=&type=&page=&limit=
POST   /customers
GET    /customers/:id
PATCH  /customers/:id
POST   /customers/:id/notes
GET    /customers/:id/notes

GET    /products             ?search=&category=&lowStock=true&page=&limit=
POST   /products
GET    /products/:id
PATCH  /products/:id
POST   /products/:id/image        (multipart upload → R2)
GET    /products/:id/movements
POST   /products/:id/movements    (manual stock adjustment, warehouse/admin only)

GET    /challans             ?status=&customerId=&page=&limit=
POST   /challans
GET    /challans/:id
PATCH  /challans/:id              (draft edits only)
POST   /challans/:id/confirm
POST   /challans/:id/cancel
GET    /challans/:id/pdf          (invoice/challan PDF export — bonus)

GET    /dashboard/summary          (counts, low-stock alerts, recent activity)
```

HTTP status conventions: `400` validation, `401` unauthenticated, `403`
forbidden by role, `404` not found, `409` business-rule conflict (e.g.
insufficient stock, duplicate SKU/email), `500` unexpected.

---

## 6. Cloudflare R2 Integration

- Use `@aws-sdk/client-s3` pointed at the R2 endpoint
  (`https://<account_id>.r2.cloudflarestorage.com`), credentials via env vars
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ACCOUNT_ID`,
  `R2_PUBLIC_URL`.
- `POST /products/:id/image` accepts multipart, validates it's an image
  (mimetype + max 5MB), uploads to `products/<product_id>/<uuid>.<ext>`,
  saves the public/CDN URL on `products.image_url`.
- Prefer presigned PUT URLs from the backend so the browser uploads directly
  to R2 (lower backend load) — implement `POST /products/:id/image-upload-url`
  returning a presigned URL + the final public URL to store.

---

## 7. Frontend (Next.js App Router)

### Route map
```
/                        marketing landing page (public)
/login                   auth
/dashboard                overview: KPI cards, low-stock alerts, recent challans
/dashboard/customers       list + search + filters
/dashboard/customers/[id]  detail: info, follow-up notes timeline, edit
/dashboard/products         list + low-stock badge
/dashboard/products/[id]    detail: info, stock movement log, adjust stock, image upload
/dashboard/challans          list + status filter
/dashboard/challans/new       multi-product challan builder
/dashboard/challans/[id]      detail: items, status, confirm/cancel, PDF export
```

- Route-group `(auth)` for `/login`, route-group `(dashboard)` with a shared
  shell layout (sidebar nav filtered by role, topbar with user menu).
- Data fetching: server components for initial page loads hitting the API with
  the forwarded auth cookie; client components + a small fetch wrapper
  (`lib/api.ts`) for mutations, with optimistic UI on stock-sensitive actions
  avoided (rely on the transactional API response instead — never trust the
  client's idea of current stock).
- Form handling: `react-hook-form` + the same Zod schemas from
  `packages/types` for client-side validation mirroring the backend.
- Global toast/error handling: surface `error.message` from the API's
  structured error shape; role-forbidden actions are hidden, not just
  disabled, to keep the UI honest about what each role can do.

### Landing page — design direction (per the studio brief)
The product is an **operations backbone for a wholesale/distribution
business** — its world is warehouses, challans, ledgers, stock counts, not a
generic "SaaS dashboard." Design direction:

- **Palette**: deep slate/graphite background panel (`#12151B`) paired with a
  warm paper/ivory content surface (`#FAF8F3`), a single confident accent —
  an indigo-blue used sparingly for primary actions (`#2F3A8F`), a muted amber
  for stock/alert states (`#C98A2C`), and a hairline neutral (`#D8D3C7`) for
  borders/dividers. Named tokens: `--ink:#12151B; --paper:#FAF8F3;
  --accent:#2F3A8F; --alert:#C98A2C; --line:#D8D3C7; --muted:#6B6A63;`
- **Type**: a condensed, slightly industrial grotesk for display (e.g. "Archivo"
  or "Space Grotesk") set tight and large for the hero headline; a workhorse
  humanist sans (e.g. "Inter") for body copy; a monospace (e.g. "IBM Plex Mono")
  used specifically for challan numbers, SKUs, and stock counts anywhere they
  appear — this is the signature detail that ties the marketing page to the
  actual product's data.
- **Hero**: not a generic headline+screenshot. Show a live-feeling animated
  ledger strip — a thin horizontal ticker of mono-font rows
  (`CH-2026-0042 · Confirmed · 120 units`) scrolling slowly behind/beside the
  headline, implying real operational throughput. Headline should name the
  real job: e.g. "Run stock, challans, and follow-ups from one ledger" — not
  "Supercharge your business."
  - Do not use a numbered 01/02/03 feature grid unless describing an actual
  sequential flow (e.g. Draft → Confirm → Stock adjusted → Invoice — that IS a
  real sequence, so numbering there is earned).
- **Sections**: hero → the draft→confirm→stock→invoice sequence (numbered,
  because it's real) → role-based access explainer (four small role cards:
  Admin/Sales/Warehouse/Accounts, each stating what they can touch) →
  final CTA → footer.
- **Motion**: restrained — the ledger ticker in the hero is the one animated
  moment; everything else is static with subtle hover states. No scroll-jacking.
- Build fully responsive, visible keyboard focus states, and respect
  `prefers-reduced-motion` (pause the ticker).

---

## 8. Validation, Error Handling & Pagination Conventions

- Every Zod schema lives in `packages/types/src/schemas/*.ts` and is imported
  by both `apps/api` (request validation) and `apps/web` (form validation) —
  single source of truth, no drift.
- Standard paginated response shape:
  `{ data: T[], meta: { page, limit, total, totalPages } }`.
- Standard error shape: `{ error: { code: string, message: string, fields?: Record<string,string> } }`.

---

## 9. Docker & Local Dev

- `docker-compose.yml`: `postgres` (with a named volume + healthcheck),
  `api` (builds `apps/api/Dockerfile`, depends_on postgres healthy), `web`
  (builds `apps/web/Dockerfile`). All wired via a shared `.env`.
- Root `bun run dev` uses Turborepo to run `db:up` (docker compose postgres
  only) then `api#dev` and `web#dev` in parallel with dependency ordering.
- `.env.example` at root and per-app, documenting every variable (DB URL, JWT
  secrets, R2 creds, API base URL for the frontend).

---

## 10. CI/CD — GitHub Actions

`.github/workflows/ci.yml`: on push/PR — install (bun), lint, typecheck, run
`apps/api` tests against a Postgres service container, build both apps.
Optional second workflow `deploy.yml` triggered on `main` — deploys `apps/web`
to Vercel and `apps/api` to Railway/Fly using their CLIs + repo secrets
(documented but not required to actually run without the user's own tokens).

---

## 11. Testing Expectations

- Backend: Bun's built-in test runner. Unit tests for services (esp. the
  challan stock transaction), integration tests hitting a test Postgres DB for
  the full auth → create customer → create product → create+confirm challan
  → stock decremented happy path, and the insufficient-stock/concurrency edge
  cases from §4.
- Frontend: at minimum, component tests for the challan builder's client-side
  quantity validation and the low-stock badge logic.

---

## 12. Deliverables Checklist (map to the original assignment's submission list)

- [ ] GitHub repo, clean commit history (feature-scoped commits, not one giant commit)
- [ ] Live frontend URL (Vercel)
- [ ] Live backend API URL (Railway/Fly/Render)
- [ ] Test login credentials for all 4 roles (from seed script)
- [ ] Postman collection (`postman/erp-crm.postman_collection.json`)
- [ ] README: setup, env vars, local run, deploy steps, assumptions
- [ ] Architecture explanation section in README
- [ ] Known limitations section in README
- [ ] Bonus: Docker Compose ✅, GitHub Actions ✅, PDF invoice export ✅, R2 image upload ✅

---

## 13. Build Order (do not reorder)

1. Monorepo scaffold + turborepo + shared configs.
2. `packages/db` schema + migrations + seed.
3. `packages/types` shared Zod schemas.
4. `apps/api`: auth module + RBAC middleware first (everything else depends on it).
5. `apps/api`: customers module.
6. `apps/api`: products module + stock movements + R2 image upload.
7. `apps/api`: challans module (the transactional core, §4) + PDF export.
8. `apps/api`: dashboard summary endpoint.
9. `apps/web`: shell (auth pages, dashboard layout, API client, role-aware nav).
10. `apps/web`: customers pages → products pages → challans pages → dashboard KPIs.
11. `apps/web`: landing page (can be done in parallel with #9-10 by a second workstream).
12. Docker + CI.
13. Postman collection generated from the real routes.
14. README pass + seed data polish + manual QA against the role matrix in §3.
15. Deploy, replace README placeholders with live URLs, record the walkthrough.
