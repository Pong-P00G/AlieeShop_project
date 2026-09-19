# AlieeShop — Project Overview

A guided tour of what this project is, how its pieces fit together, and where to
start reading the code.

> Looking for install commands, environment variables, or the API surface? Those
> live in [README.md](./README.md). This document covers the *shape* of the
> system.
>
> Looking for the *reasoning* — what each technology is for, what every keyword
> means, and how auth, CSRF, migrations and notifications work internally? That is
> [EXPLAIN.md](./EXPLAIN.md).

---

## Table of Contents

- [What AlieeShop Is](#what-alieeshop-is)
- [CV / Résumé Highlights](#cv--résumé-highlights)
- [Feature Map](#feature-map)
- [System Architecture](#system-architecture)
- [Anatomy of a Request](#anatomy-of-a-request)
- [Repository Layout](#repository-layout)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Data & Domain Model](#data--domain-model)
- [Authentication At a Glance](#authentication-at-a-glance)
- [Conventions to Follow](#conventions-to-follow)
- [Where to Start Reading](#where-to-start-reading)
- [Glossary](#glossary)

---

## What AlieeShop Is

- **What it is** — a full-stack e-commerce platform: a storefront customers shop
  in, and an admin dashboard staff run the store from, served by one Vue 3
  single-page application talking to one Express REST API backed by PostgreSQL.
- **How it is packaged** — two self-contained packages rather than a monorepo
  with shared tooling: `vue-project/` (the SPA) and `server/` (the API).
- **Packages are independent** — each has its own `package.json`, its own `.env`,
  and its own test runner; no workspace tooling ties them together, so you
  install and run them separately.

| | Frontend | Backend |
|---|---|---|
| Location | `vue-project/` | `server/` |
| Stack | Vue 3 + Vite 7 + Pinia + Tailwind v4 | Express 5 + `pg` + JWT |
| Language | JavaScript (Composition API) | JavaScript (ES modules) |
| Dev command | `npm run dev` (port 3001) | `npm run dev` (port 5001) |
| Tests | Vitest + Testing Library | Vitest + Supertest |

---

## CV / Résumé Highlights

A copy-ready project entry for a CV, résumé, or portfolio page, followed by a
map from each claim to the section of this document that backs it up. If a
recruiter asks about any line, the evidence is one link away.

### Copy-Paste Entry

```text
Project
-----------------------------------------------
E-Commerce Web Application : Aliee Shop
-----------------------------------------------
- Architected a full-stack e-commerce platform with a clean client/server
  split — a Vue 3 SPA in vue-project/ and a REST API in server/ — serving a
  customer storefront and a staff admin dashboard from one codebase.

- Structured the backend in four layers (routes → controllers → services →
  models) plus middleware for auth, validation, and CSRF, keeping all SQL
  inside models and business rules inside services.

- Configured PostgreSQL 18 with a shared connection pool and an 18-table
  schema evolved through an ordered, tracked SQL migration runner, plus a
  one-command setup script that creates, migrates, and seeds a fresh database.

- Built secure REST APIs with Express 5 across 16 resources (auth, products,
  orders, payments, wishlist, notifications, …).

- Implemented JWT authentication in httpOnly cookies with single-use,
  SHA-256-hashed refresh tokens that rotate on every refresh — reuse is treated
  as theft and revokes every session for that user.

- Hardened the API with Helmet security headers, three tiers of rate limiting,
  CSRF protection, CORS origin checks, and Joi request validation.

- Implemented admin/user role management, enforcing authorization at both the
  route level (isAdmin) and the row level (owner-or-admin checks keyed on
  user_id / role_id).

- Developed a built-in admin dashboard with Chart.js analytics, reports, and an
  audit activity log, for managing products, categories, variants, stock,
  discounts, orders, users, store settings, and the storefront hero carousel.

- Built the checkout flow end to end — persisted cart drawer, multi-step
  checkout, shipping method selection, configurable payments including cash on
  delivery with an optional fee, and PDF receipt generation.

- Built a fully responsive storefront with Vue 3, Pinia, Vue Router, and
  Tailwind CSS v4, using reusable components, two layouts, and route guards for
  protected pages.

- Shipped SEO and PWA features: per-route meta and Open Graph tags, canonical
  URLs, a dynamic /sitemap.xml and /robots.txt generated from live product data,
  and web push notifications.

- Wrote 629 automated tests (197 frontend, 256 backend unit, 176 backend
  integration) covering services, routes, stores, and components.

Repository: https://github.com/Pong-P00G/Ecommerce-app
-----------------------------------------------
```

### Claim → Evidence

| Claim in the entry | Where it is documented |
|---|---|
| Four-layer backend | [Backend Architecture](#backend-architecture) |
| Connection pool + 18-table schema | [Data & Domain Model](#data--domain-model) |
| 16 REST resources | [Route modules](#route-modules) |
| JWT cookies + refresh rotation | [Authentication At a Glance](#authentication-at-a-glance) |
| Helmet, rate limiting, CSRF, Joi | [Request pipeline](#request-pipeline-serversrcmainjs) |
| Role-level and row-level authorization | [README → Request authorization](./README.md#request-authorization) |
| Admin dashboard surfaces | [Feature Map → Admin dashboard](#admin-dashboard-admin) |
| Checkout and COD fee | [Feature Map → Storefront](#storefront-customer-facing) |
| Two layouts and route guards | [Frontend Architecture](#frontend-architecture) |
| Sitemap, robots, OG tags | [Feature Map → Platform concerns](#platform-concerns) |
| 629 tests | [README → Testing](./README.md#testing) |

> **Keep the numbers.** "16 resources", "18 tables" and "629 tests" are what
> turn a feature list into evidence of scope. If you trim this entry for space,
> cut whole bullets — never the numbers inside them.

---

## Feature Map

### Storefront (customer-facing)

- **Catalog** — product listing with search, category filtering, sorting, and a
  price-range slider; product detail pages with variants, image lightbox, and
  related/recently-viewed carousels.
- **Discovery** — hero carousel, tabbed product carousels, quick-view modal,
  search overlay, wishlist, and product comparison.
- **Cart & checkout** — slide-out cart drawer, persisted cart, multi-step
  checkout, shipping method selection, and a payment step.
- **Payments** — configurable payment methods including cash on delivery with an
  optional COD fee; order confirmation and PDF receipt generation.
- **Account** — register, login, password reset, profile, address book, order
  history, wishlist, and notifications.
- **Content pages** — About, Contact, FAQ, Shipping, Returns, Track Order, Gift
  Cards, Careers, Press, Blog, Privacy Policy, Terms of Service, and Sitemap.
- **Extras** — dark/light theme toggle, cookie consent, newsletter popup,
  back-to-top, toast notifications, and PWA-style web push.

### Admin dashboard (`/admin/*`)

- **Analytics** — dashboard charts (Chart.js), reports, and an activity log.
- **Catalog management** — products, categories, variants, stock levels,
  discounts, and image upload.
- **Operations** — orders, reviews, users, payment methods, and store
  configuration incl. service fees.
- **Access control** — a role/permission manager.
- **Notifications** — admin broadcasts and a full notification history.

### Platform concerns

- **SEO** — per-route titles, descriptions, Open Graph/Twitter tags, canonical
  URLs, plus dynamic `/robots.txt` and `/sitemap.xml` generated from the live
  product table.
- **Security** — JWT auth in httpOnly cookies, CSRF protection, Helmet headers,
  rate limiting, request validation with Joi, and owner-or-admin row checks.
- **Observability** — request logging and a `/health` endpoint.

---

## System Architecture

```
Browser (Vue 3 SPA, :3001 dev)
        │
        │  /api/*                (axios, withCredentials)
        ▼
Express API (:5001)
  Helmet → rate limit → CORS → body parsers → cookie parser → CSRF
        │
        ▼
routes → controller → service → model → pg connection pool
        │
        ▼
PostgreSQL 18 (:5432)
```

Two rules describe almost all traffic:

1. **The SPA never touches the database.** Every read and write goes through the
   REST API under `/api`.
2. **The API never renders HTML.** It answers JSON, except for `/robots.txt` and
   `/sitemap.xml`.

### Product images live in object storage

Product images are not stored in the frontend bundle or on the API's disk. They
are uploaded to an S3-compatible bucket (Cloudflare R2) and served by its CDN, so
the storefront, the admin dashboard, and the sitemap all reference the same
public URL and image bytes never travel through the API.

`server/src/services/storageService.js` owns that bucket, and the one-off
`npm run images:migrate` moves any files left over from the old local `/cdn`
mount across and rewrites their stored URLs.

---

## Anatomy of a Request

Tracing one authenticated write — say an admin saving a product edit — shows how
the layers cooperate:

1. **Client** — an `axios` instance in `vue-project/src/api/api.js` attaches
   credentials and the CSRF header, then sends the request to `/api/...`.
2. **Global middleware** (`server/src/main.js`) — Helmet sets security headers,
   the rate limiter counts the request, CORS checks the origin, and the CSRF
   middleware validates the token on state-changing methods.
3. **Route** (`server/src/routes/*.js`) — matches the path and stacks the
   middleware for that endpoint, typically `protect` → `isAdmin` → a Joi
   validator.
4. **Controller** (`server/src/controller/*.js`) — parses the request, calls the
   service, and shapes the JSON response. Controllers stay thin.
5. **Service** (`server/src/services/*.js`) — holds the business rules:
   validation beyond schema checks, ownership rules, and orchestration across
   several models.
6. **Model** (`server/src/model/*.js`) — the only place SQL is written. Queries
   run through the shared pool in `server/src/database/dbpool.js`.
7. **Response** — JSON travels back; on a `401` the client silently refreshes the
   access token and replays the request once.

The layering is consistent, which makes it a reliable map: if you know which
layer a concern belongs to, you know which file to open.

---

## Repository Layout

```
aliee-shop/
├── cdn/images/products/     # Local images (uploaded to R2 by `npm run images:migrate`)
├── server/                  # Express API
│   ├── migrations/          # Ordered SQL migrations
│   ├── src/
│   │   ├── controller/      # Thin HTTP handlers
│   │   ├── database/        # pg pool
│   │   ├── middleware/      # auth, CSRF, rate limit, Joi validation
│   │   ├── model/           # SQL — the only place queries live
│   │   ├── routes/          # URL → middleware → controller wiring
│   │   ├── services/        # Business logic
│   │   └── main.js          # App assembly, route mounting, SEO endpoints
│   ├── tests/               # Unit + integration tests
│   ├── migrate.js           # Migration runner
│   └── seed_products.sql    # Sample catalog data
└── vue-project/             # Vue 3 SPA
    ├── public/sw.js         # Service worker (web push)
    ├── src/
    │   ├── api/             # One module per backend resource
    │   ├── components/      # Reusable UI (cart drawer, modals, carousels…)
    │   ├── composables/     # Theme, breakpoints, toasts, scroll reveal
    │   ├── Layout/          # HomeLayout & DashboardLayout
    │   ├── router/          # Routes, guards, per-page SEO metadata
    │   ├── stores/          # Pinia stores
    │   └── views/           # Pages, grouped by area
    └── test/                # Component, store, api and router tests
```

The two directories you will spend the most time in are
`server/src/services/` (business rules) and `vue-project/src/views/`
(screens), with `vue-project/src/stores/` as the bridge between screens and the
API.

---

## Frontend Architecture

### Views are grouped by audience

| Folder | Contents |
|---|---|
| `views/` (root) | Storefront pages, account pages, cart/order flow |
| `views/auth/` | Login, Register, Forgot password |
| `views/checkout/` | Checkout flow |
| `views/products/` | Product listing and detail |
| `views/dashboard/` | Every `/admin/*` screen |
| `views/pages/` | Informational and policy pages |

### Two layouts, two worlds

`HomeLayout.vue` wraps the storefront (navbar, footer, cart drawer, newsletter
popup, cookie consent); `DashboardLayout.vue` wraps the admin area (sidebar,
topbar, notification bell). The router nests every route under one of them, so
chrome is declared once rather than per page.

### State lives in Pinia

| Store | Responsibility |
|---|---|
| `auth.js` | Session, user, role, init/refresh lifecycle |
| `product.js` | Catalog, categories, variants, stock, discounts, filters |
| `shop.js` | Cart contents and checkout totals |
| `wishlist` / `recentlyViewed` | Saved and recently seen products |
| `notifications.js` | Single source of truth for the unread badge |
| `ui.js` | Sidebar, drawer, search overlay, persisted UI prefs |

The notifications store is worth calling out as the pattern to copy: rather than
each bell and page polling independently, one store owns the unread count, polls
on a single timer, and syncs across tabs over a `BroadcastChannel`. Any new piece
of cross-cutting UI state should follow that model instead of duplicating timers.

### Routing enforces access

Route metadata drives guards in `router/index.js`:

- `requiresAuth` — redirects anonymous users to login.
- `requiresAdmin` — admin is `role_id === 1`; others are bounced home.
- The guard waits for `authStore.initialized` before deciding, which prevents the
  stale-redirect bug where a valid session lands on the login page.

The same file owns per-route SEO metadata, applied in `router.afterEach` and
disposed on navigation. `ProductDetail` and `blogPost` opt out because they set
their own tags dynamically.

---

## Backend Architecture

### Request pipeline (`server/src/main.js`)

Middleware order matters and is intentional: Helmet → compression → rate limiter
→ CORS → body parsers → cookie parser → CSRF → logger → routes. The 404 and
global error handlers are registered last, after every route.

`trust proxy` is enabled only in production so rate limiting sees the real client
IP behind a reverse proxy.

### Route modules

Each file in `server/src/routes/` owns one resource — `auth`, `users`,
`products`, `cart`, `orders`, `payments`, `reviews`, `addresses`, `shipping`,
`wishlist`, `newsletter`, `roles`, `dashboard`, `settings`, `notifications`,
`images`. All are mounted under `/api/<name>`, mirroring the modules in
`vue-project/src/api/` one for one, so a UI call and its handler are easy to pair
up.

### Middleware

| File | Role |
|---|---|
| `authMiddleWare.js` | `protect` (verify JWT + expiry) and `isAdmin` |
| `csrfMiddleware.js` | Issues the CSRF cookie; validates the header on writes |
| `rateLimitMiddleware.js` | Global, auth, and refresh limiters |
| `validationMiddleWare.js` / `productValidation.js` | Joi schemas per endpoint |

### Services vs. models

Services own *decisions*; models own *SQL*. Keeping queries out of services and
rules out of models is what makes the API testable — the unit tests target
services, and the integration tests exercise routes against a real database.

Two orchestration examples live in `dashboardService.js`: notification creation
always goes through one helper that writes the row first and then dispatches a
best-effort push, and audit/log entries are written alongside the action they
describe. Reuse those helpers rather than writing notifications or audit rows
directly.

---

## Data & Domain Model

PostgreSQL 18, with schema changes applied through the ordered files in
`server/migrations/` and tracked in a `schema_migrations` table. Run
`npm run migrate` after pulling; `npm run migrate -- --status` shows what is
pending.

`npm run setup` is the one-command path for a fresh machine: it creates the
database, loads the core schema from `server/schema/000_base_schema.sql`, runs
the migrations, and seeds sample products. That baseline file exists because the
migrations are strictly additive — they add feature tables and columns but never
created the core tables (`products`, `users`, `category`, `orders`, `cart`,
`stock`, …), so on their own they cannot build a database that the app can use.

Core concepts:

| Concept | Notes |
|---|---|
| **Products** | Named with a `productsid` primary key; belong to a category; carry images and tags; have an `active`/inactive status that gates the sitemap. |
| **Variants & stock** | A product can have variants with their own pricing; stock is tracked per variant/product, with a low-stock view for the dashboard. |
| **Discounts** | Applied to products and surfaced in the admin listing. |
| **Orders** | Owned by a user, carry line items, a status, and one or more payments. |
| **Payments** | Methods are configurable, including cash on delivery with an optional fee. |
| **Reviews** | Tied to a product and a user; editable by the author or an admin. |
| **Wishlist / cart** | Implicitly scoped to the requesting user. |
| **Notifications & audit log** | Personal rows carry a `userid`; broadcast rows do not. |
| **Roles & permissions** | Roles, permissions, and their assignments back the dashboard RBAC screens. |
| **Store settings** | Single-row configuration for fees and store-wide options. |
| **Hero slides** | Admin-managed storefront carousel: per-slide copy, image, CTA, display order and visibility, plus the `hero_*` section settings (autoplay, secondary button). |

Two schema details are easy to trip over:

- Column names are lowercase and unquoted (`productsid`, `createdat`,
  `updatedat`, `password_hash`), so always match existing naming instead of
  inventing camelCase.
- Password hashing happens **only** in the application layer (bcrypt). Legacy
  database triggers that double-hashed passwords were removed by a migration —
  do not reintroduce DB-side hashing.

---

## Authentication At a Glance

The browser never stores a long-lived credential. Sessions are carried by two
httpOnly cookies:

- **`auth_token`** — short-lived JWT (default 15m), verified on every protected
  request, scoped to `/`.
- **`refresh_token`** — opaque, single-use, rotated on every refresh, scoped to
  `/api/auth`. Only its SHA-256 hash is stored.

When an access token expires the client refreshes and replays the request once.
Reusing an already-rotated refresh token is treated as theft and revokes every
session for that user. `logout-all` (and any password change) does the same
deliberately.

Authorization is enforced in two layers: route-level (`isAdmin` on admin
endpoints, self-only on profile updates so a user cannot change their own
`role_id`) and row-level (orders, payments, addresses, and reviews check the
row's owner against the caller and answer `403` otherwise).

The full cookie, rate-limit, and CORS detail is documented in
[README.md](./README.md#authentication--session-security).

---

## Conventions to Follow

- **Match the layering.** New API work goes route → controller → service →
  model. Do not put SQL in a controller or HTTP concerns in a model.
- **One API module per resource on each side.** If the backend gains a route
  file, the frontend gains a matching `src/api/` module.
- **Validate at the edge.** Request shape is Joi's job in middleware; business
  rules are the service's job.
- **Keep the client-side secret-free.** Only `VITE_*` values reach the bundle,
  and they are inlined at build time — never prefix a secret with `VITE_`.
- **Reuse the shared helpers.** Notifications and audit rows have single
  creation paths; error responses use the established
  `{ success: false, message }` shape.
- **Lowercase, unquoted column names.** They are part of the existing schema and
  Postgres folds unquoted identifiers to lowercase anyway.
- **Test where the test already lives.** Service logic → `server/tests/` unit
  tests; route behavior → the integration suite; UI behavior →
  `vue-project/test/`.

---

## Where to Start Reading

Depending on what you are trying to change:

| Goal | Start at |
|---|---|
| Understand the API surface | `server/src/main.js` (route mounting) → `server/src/routes/` |
| Change a business rule | The matching `server/src/services/` file |
| Change a database query | `server/src/model/` |
| Add or change a schema field | `server/migrations/` (add a new file; never edit an applied one) |
| Set up a database from scratch | `npm run setup` — see `server/setup.js` and `server/schema/` |
| Add a screen | `vue-project/src/views/` + a route in `vue-project/src/router/index.js` |
| Change what data a page holds | `vue-project/src/stores/` |
| Change how the app talks to the API | `vue-project/src/api/` |
| Debug login, sessions, or permissions | `vue-project/src/stores/auth.js`, `server/src/middleware/authMiddleWare.js`, `server/src/services/tokenService.js` |
| Debug notifications or push | `server/src/services/dashboardService.js`, `server/src/services/pushService.js`, `vue-project/src/stores/notifications.js` |

---

## Glossary

| Term | Meaning |
|---|---|
| **Storefront** | The customer-facing SPA routes served under `/`. |
| **Dashboard / Admin** | The staff-facing routes under `/admin/*`, gated by `role_id === 1`. |
| **Access token** | The short-lived JWT in the `auth_token` cookie. |
| **Refresh token** | The single-use, rotated token in the `refresh_token` cookie that mints new access tokens. |
| **Protect** | The middleware that verifies the access token and attaches `req.user`. |
| **CDN** | The Cloudflare R2 public origin (`R2_PUBLIC_BASE_URL`) that serves product images. |
| **Broadcast** | A notification with no `userid`, intended for all admins. |
| **Owner-or-admin** | The row-level authorization rule applied to orders, payments, addresses, and reviews. |

---

<p align="center">
  Part of the AlieeShop project — see <a href="./README.md">README.md</a> for setup and operations.
</p>
