# AlieeShop — Deep Dive, Keywords & Tech Stack

This document explains **how AlieeShop works and why it is built the way it is**.
It is written to be read start to finish, but every section stands alone.

If you are preparing to explain this project in an interview, read
[§17 Interview Q&A](#17-interview-qa) — it is the compression of everything below.
If you are looking for one specific file, [§16 Per-File Walkthrough](#16-per-file-walkthrough)
describes every important one in reading order.

| If you want… | Read |
|---|---|
| A guided tour of the codebase | [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) |
| Install commands, env vars, API list | [README.md](./README.md) |
| **Why it works the way it does, and what every term means** | **this file** |

---

## Table of Contents

1. [How to Read This Document](#1-how-to-read-this-document)
2. [The Mental Model](#2-the-mental-model)
3. [Tech Stack, Explained](#3-tech-stack-explained)
   - [Frontend](#frontend)
   - [Backend](#backend)
   - [Data & Tooling](#data--tooling)
4. [Glossary A — Architecture & Backend Keywords](#4-glossary-a--architecture--backend-keywords)
5. [Glossary B — Auth & Security Keywords](#5-glossary-b--auth--security-keywords)
6. [Glossary C — Frontend Keywords](#6-glossary-c--frontend-keywords)
7. [Glossary D — Database Keywords](#7-glossary-d--database-keywords)
8. [Glossary E — Testing & Tooling Keywords](#8-glossary-e--testing--tooling-keywords)
9. [Deep Dive: The Life of One Request](#9-deep-dive-the-life-of-one-request)
10. [Deep Dive: Authentication & Sessions](#10-deep-dive-authentication--sessions)
11. [Deep Dive: CSRF Protection](#11-deep-dive-csrf-protection)
12. [Deep Dive: Authorization in Two Layers](#12-deep-dive-authorization-in-two-layers)
13. [Deep Dive: The Database & Migrations](#13-deep-dive-the-database--migrations)
14. [Deep Dive: Frontend State & the Notification Sync Problem](#14-deep-dive-frontend-state--the-notification-sync-problem)
15. [Deep Dive: SEO, Sitemap & Web Push](#15-deep-dive-seo-sitemap--web-push)
16. [Per-File Walkthrough](#16-per-file-walkthrough)
17. [Interview Q&A](#17-interview-qa)
18. [Gotchas, Inconsistencies & Honest Weak Spots](#18-gotchas-inconsistencies--honest-weak-spots)

---

## 1. How to Read This Document

Three kinds of content live here:

- **Glossary entries** (§4–§8) — a keyword you might hear in a review or interview,
  what it means in general, and **exactly where this repo uses it**.
- **Deep dives** (§9–§15) — one mechanism traced end to end, with the real file
  names and the reasoning behind each choice.
- **Per-file walkthrough** (§16) — what each important file is for and what to
  look for in it, grouped by layer.
- **Q&A and gotchas** (§17–§18) — rehearsal material, including the parts of the
  code that are inconsistent. Knowing your own weak spots is a better interview
  answer than pretending there are none.

---

## 2. The Mental Model

Four sentences cover the whole system:

1. **One SPA, one API, one database.** A Vue 3 single-page application is the only
   user interface. It never talks to PostgreSQL. It only talks to an Express API,
   which answers JSON. The API never renders HTML for the app.
2. **Everything goes through `/api/<resource>`.** Sixteen route modules, one per
   resource, each mounted in `server/src/main.js`. The frontend has a matching
   `src/api/` module per resource, so a UI call and its handler pair up one-to-one.
3. **Each layer has exactly one job.** Routes wire URLs to handlers and middleware.
   Controllers translate HTTP to function calls. Services hold business rules.
   Models hold SQL. Nothing reaches across.
4. **Sessions live in cookies, not in JavaScript.** Two httpOnly cookies carry the
   session, so no token is ever readable by page scripts, and no long-lived
   credential sits in `localStorage`.

```
┌──────────────────────────┐        ┌──────────────────────────┐        ┌───────────────┐
│  vue-project/  (:3001)   │        │   server/     (:5001)    │        │ PostgreSQL 18 │
│                          │        │                          │        │   (:5432)     │
│  Vue 3 + Pinia + Router  │  HTTP  │  Express 5               │  SQL   │               │
│  Tailwind v4             │ ─────► │  routes → controller →   │ ─────► │  18 tables    │
│  axios (withCredentials) │  JSON  │  service → model          │  pool  │  5 views      │
└──────────────────────────┘        └──────────────────────────┘        └───────────────┘
        ▲                                       ▲
        │ image uploads → R2 + CDN               │ /health, /robots.txt, /sitemap.xml
        └───────────────────────────────────────┘
```

---

## 3. Tech Stack, Explained

For each tool: **what it is**, **why it is here**, and **where you see it**.

### Frontend

Package file: `vue-project/package.json`. Dev server on **port 3001**.

| Technology | Version | What it is | Why it is here | Where |
|---|---|---|---|---|
| **Vue 3** | ^3.5.17 | Progressive UI framework | Component model; Composition API keeps logic next to the markup | `src/views/`, `src/components/` |
| **Vite 7** | ^7.0.0 | Build tool + dev server | Instant HMR, native ES modules in dev, Rollup bundling in prod | `vite.config.js` |
| **Pinia** | ^3.0.3 | Official Vue state store | One owner per piece of shared state; replaces prop-drilling | `src/stores/` |
| **Vue Router** | ^4.5.1 | Client-side router | URL → view mapping, lazy chunks, navigation guards, SEO metadata | `src/router/index.js` |
| **Tailwind CSS v4** | ^4.1.18 | Utility-first CSS | Consistent spacing/colour/press states without a stylesheet per component | all `.vue` files |
| **@tailwindcss/vite** | ^4.1.18 | Tailwind's Vite plugin | v4 compiles through Vite instead of PostCSS | `vite.config.js` |
| **Axios** | ^1.11.0 | HTTP client | Interceptors — the whole refresh-and-replay flow hangs off them | `src/api/api.js` |
| **Unhead (`@unhead/vue`)** | ^3.1.7 | Head/meta manager | Per-route `<title>`, description, OG and canonical tags | `src/head.js`, `router/index.js` |
| **Chart.js + vue-chartjs** | ^4.5.1 / ^5.3.4 | Charting library | Admin analytics dashboard | `views/dashboard/Analytic.vue` |
| **html2pdf.js** | ^0.14.0 | DOM → PDF in the browser | Order receipts without a server-side PDF service | `src/utility/DownloadReceipt.js` |
| **Lucide Vue Next** | ^0.534.0 | Icon set | Tree-shakeable icons; gets its own build chunk | components |
| **@heroicons/vue** | ^2.2.0 | Second icon set | Used alongside Lucide in some components | components |
| **vuedraggable** | ^4.1.0 | Drag-and-drop | Drag-to-reorder lists in the admin dashboard | `views/dashboard/Dashboard.vue` |
| **shadcn** | ^4.21.0 | Component conventions | Consistent styling primitives | components |
| **@fontsource-variable/geist** | ^5.3.0 | Self-hosted font files | No third-party font request, no layout shift | `assets/main.css` |
| **tw-animate-css** | ^1.4.0 | Animation utilities for Tailwind | Transitions on drawers, modals, carousels | `assets/main.css` |

**Vite specifics worth knowing** (`vue-project/vite.config.js`):

- **Dev proxy** — `/api` is proxied to `http://localhost:5001`. This is why the
  frontend can call `/api/...` with no CORS involvement in development at all: the
  browser thinks it is talking to `localhost:3001`.
- **Path alias** — `@` → `vue-project/src`. Both `@/...` and relative imports appear
  in the code, so use whichever the neighbouring file uses.
- **`manualChunks`** — the production bundle is split into `vue`, `lucide-vue-next`
  and `vendor`. Splitting `lucide` out is deliberate: an icon set is large and
  changes independently of app code, so it caches separately. `chunkSizeWarningLimit`
  is raised to 1500 kB, an honest admission that this is a feature-heavy SPA.
- **Devtools are conditional** — `vite-plugin-vue-devtools` is imported dynamically
  and only registered when `NODE_ENV !== 'production'`, so it never ships.

### Backend

Package file: `server/package.json`. API on **port 5001**. `"type": "module"`, so
everything is native `import`/`export` — no Babel/TS compile step.

| Technology | Version | What it is | Why it is here |
|---|---|---|---|
| **Express 5** | ^5.1.0 | HTTP framework | Routing + middleware chain; v5 also forwards async errors, so the global error handler catches `await` failures |
| **pg** | ^8.16.3 | PostgreSQL driver | `Pool` for connection reuse; parameterised queries |
| **jsonwebtoken** | ^9.0.2 | JWT sign/verify | The short-lived access token |
| **bcrypt** | ^6.0.0 | Password hashing | Slow, salted hashing — the app layer is the *only* place hashing happens |
| **Joi** | ^18.0.1 | Schema validation | Rejects malformed bodies before any business logic runs |
| **helmet** | ^8.3.0 | Security headers | Sensible defaults (CSP, `nosniff`, frame denial, referrer policy) in one line |
| **compression** | ^1.8.1 | gzip | Shrinks JSON responses; meaningful for large product lists |
| **express-rate-limit** | ^8.6.0 | Rate limiting | Global + two endpoint-specific limiters |
| **cookie-parser** | ^1.4.7 | Cookie parsing | Turns the `Cookie` header into `req.cookies` |
| **cors** | ^2.8.5 | CORS headers | Explicit origin allowlist with `credentials: true` |
| **multer** | ^2.0.2 | `multipart/form-data` | Image upload |
| **@aws-sdk/client-s3** | ^3.1135.0 | S3 client | Uploads product images to Cloudflare R2 |
| **web-push** | ^3.6.7 | VAPID push | Sends notifications to browser push services |
| **Vitest + Supertest** | ^4.1.10 / ^7.2.2 | Test runner + HTTP assertions | Unit tests and integration tests against real routes |

### Data & Tooling

| Technology | Version | What it is | Why it is here |
|---|---|---|---|
| **PostgreSQL 18** | — | Relational database | Transactions, constraints, views, `pgcrypto` for hashing helpers |
| **Node.js** | >= 22 | Runtime | `--env-file`, `--watch`, native ESM |
| **Vitest** | ^4.1.10 (API), ^3.2.4 (SPA) | Test runner | One tool for both packages; jsdom for the frontend, a real DB for integration |
| **@testing-library/vue** | ^8.1.0 | Component testing | Assert on what the user sees, not internal state |
| **jsdom** | ^26.1.0 | DOM in Node | Lets component/store tests run without a browser |
| **dotenv** | ^17.2.1 | Loads `.env` | Kept for portability; the npm scripts already use Node's native `--env-file` |

---

## 4. Glossary A — Architecture & Backend Keywords

**SPA (Single-Page Application)**
One HTML document; navigation replaces views in JavaScript instead of requesting new
pages. *Here:* `vue-project/` is the SPA. Server-side it is served as static files
(port 80 in production); all data arrives over `/api`.

**REST API**
An interface organised around resources and HTTP verbs: `GET /api/products/12`,
`POST /api/orders`. *Here:* 16 resources, all mounted under `/api/<name>` in
`server/src/main.js`.

**Layered architecture**
Splitting code by responsibility so each layer only calls the one below it.
*Here:* `routes → controllers → services → models`. Also called **MVC-ish** — see
the next entry.

**MVC vs. layered**
Classic MVC is Model–View–Controller: the controller handles input, the model holds
data *and* rules, the view renders. *Here* the roles are split further: controllers
are thin HTTP adapters, **services hold the rules**, and **models hold only SQL**,
while the "view" is a separate Vue app entirely. So describing this as "layered"
or "MVC with a service layer" is more accurate than plain MVC.

**Controller**
Translates HTTP into a function call and back. *Here:* `server/src/controller/*.js`.
It reads `req.params`/`req.body`, calls a service, picks a status code. It must not
contain SQL or business rules.

**Service**
Where decisions live: ownership checks, orchestration across several models,
"can this be deleted?" rules. *Here:* `server/src/services/*.js` (16 files).
Unit tests target this layer, which is why the layer boundary pays for itself.

**Model**
The **only** place SQL is written. *Here:* `server/src/model/*.js` plus
`server/src/model/products/`. Queries run on the shared pool.

**Middleware**
A function with `(req, res, next)` that runs in a chain before the route handler.
*Here:* `server/src/middleware/` — `protect`, `isAdmin`, CSRF, rate limiters, Joi
validators. Express runs them **in registration order**, which is why the order in
`main.js` is load-bearing (see §9).

**Connection pool**
A cache of open database connections, reused instead of connecting per request.
*Here:* `server/src/database/dbpool.js` — `max: 10`, `idleTimeoutMillis: 30000`,
`connectionTimeoutMillis: 2000`. Connecting to Postgres costs ~20–50 ms; a pool
turns that into a borrow from a warm set.

**CDN / object storage**
Product images are uploaded to an S3-compatible bucket (Cloudflare R2) and served
from its public CDN origin, configured as `R2_PUBLIC_BASE_URL` — a custom domain on
Cloudflare is the intended setup. Every object is written with a one-year
`immutable` `Cache-Control` (`R2_CACHE_CONTROL` overrides it), so the CDN keeps the
image at the edge. The API only authorises and relays uploads
(`server/src/services/storageService.js`) — it never stores image bytes, so the
storefront, the admin dashboard and the sitemap all reference the same CDN URL
without competing for API bandwidth.

**PWA (Progressive Web App)**
A web app that can install, work offline, and receive push. *Here:* the web-push
part is implemented (`vue-project/public/sw.js` + `web-push`); there is no offline
cache/manifest story, so "PWA-style push" is the honest description.

**Service worker**
A background script the browser runs outside the page, able to receive push events
while the tab is closed. *Here:* `public/sw.js` renders the notification and reads
the click target from `notification.data.url`.

**Idempotent**
Running it twice has the same effect as running it once. *Here:* `npm run setup` and
`npm run migrate` are both idempotent — setup skips an existing database, and the
migration runner skips files already recorded in `schema_migrations`.

**Environment variable / `.env`**
Configuration supplied at runtime instead of committed to the repo. *Here:*
`server/.env` (secrets, DB credentials) and `vue-project/.env` (`VITE_*` only). Loaded
by Node's native `--env-file=.env` in the npm scripts.

---

## 5. Glossary B — Auth & Security Keywords

**JWT (JSON Web Token)**
A signed, self-describing token: `header.payload.signature`. Anyone can read the
payload; only the holder of the secret can *forge* one. *Here:*
`jsonwebtoken` signs `{ id, role_id }` with `JWT_SECRET` and a 15-minute expiry
(`tokenService.signAccessToken`). The middleware verifies both signature **and**
expiry — a signature-only check would accept expired tokens.

**Access token**
The short-lived credential sent on every request. *Here:* a JWT in the `auth_token`
cookie, `path: /`, default TTL 15m (`ACCESS_TOKEN_EXPIRES_IN`).

**Refresh token**
A long-lived credential whose only job is to mint new access tokens. *Here:* an
**opaque** random value — 32 random bytes hex-encoded (`crypto.randomBytes(32)`),
not a JWT — stored in the `refresh_tokens` table as a **SHA-256 hash**, in a cookie
scoped to `path: /api/auth` so it is only ever transmitted to auth endpoints.
Lifetime 7d, or 30d with "Remember me".

**Token rotation**
Issuing a new refresh token every time one is used, and immediately revoking the old
one — so a stolen token has a short usable life. *Here:*
`rotateRefreshToken` revokes the presented row before issuing a pair.

**Refresh-token reuse detection**
If a *already-revoked* refresh token is presented, that means someone kept a copy;
the safe response is to assume theft and kill every session for that user. *Here:*
`rotateRefreshToken` calls `revokeAllUserRefreshTokens(stored.user_id)` when it sees
a revoked or expired row. Same behaviour deliberately on password change and
`/api/auth/logout-all`.

**httpOnly cookie**
A cookie JavaScript cannot read (`document.cookie` will not show it). The primary
defence against token theft via XSS. *Here:* both `auth_token` and `refresh_token`
are httpOnly.

**`sameSite` / `secure` cookie flags**
`sameSite=lax` blocks the cookie on most cross-site requests (CSRF defence);
`secure` means HTTPS-only. *Here:* both auth cookies are `lax` + `secure` when
`NODE_ENV=production`. The CSRF cookie is deliberately `httpOnly: false` — see §11.

**CSRF (Cross-Site Request Forgery)**
Tricking a logged-in user's browser into sending a state-changing request to your
site from another site. Cookies are attached automatically, so the server cannot
tell the difference by cookies alone. **Double-submit cookie** is the fix used here:
the server plants a random, *readable* `csrf-token` cookie and requires the client to
echo it in the `x-csrf-token` header. Only same-origin JavaScript can read the cookie
and set that header, so a cross-site form cannot forge it. See §11.

**CORS (Cross-Origin Resource Sharing)**
The browser rule that stops `localhost:3001` from reading responses from
`localhost:5001` unless the API opts in. *Here:* an explicit allowlist of
`FRONTEND_URL` plus (development only) `localhost:3001`, `5173`, `127.0.0.1:5173`,
with `credentials: true`. No wildcard — a wildcard is incompatible with credentialed
requests anyway.

**Rate limiting / brute force**
Capping requests per client per window so password guessing becomes impractical.
*Here:* three limiters — global **200 requests / 15 min** for everything, auth
**10 failed attempts / 15 min** (successful logins are *not* counted, so a shared
NAT/campus IP is not locked out by someone else's typos), refresh **60 / 15 min**.

**Helmet**
One middleware that sets a batch of hardening response headers (Content-Security-Policy,
`X-Content-Type-Options: nosniff`, frame denial, referrer policy, HSTS in HTTPS).
*Here:* `app.use(helmet())` is the **first** middleware.

**bcrypt**
A deliberately slow, salted password hash. Salt = random per-password data so two
identical passwords hash differently; the cost factor makes offline guessing
expensive. *Here:* hashing happens **only** in the application layer. Legacy database
triggers that hashed at the DB level were removed by
`migrations/remove_password_hash_triggers.sql` — do not reintroduce them.

**RBAC (Role-Based Access Control)**
Permissions attached to roles rather than to individuals. *Here:* a `roles` table,
a `permissions` table and role assignments (migration `add_role_permissions.sql`),
exposed through `/api/roles` and the `RolePermissionManager.vue` admin screen. The
frontend caches the permission keys and exposes `can(key)` / `canAny()` / `canAll()`
getters on the auth store.

**Owner-or-admin / row-level authorization**
Route-level guards answer "may this *kind* of user call this endpoint?" Row-level
checks answer "may this user touch *this specific row*?" — the latter is what stops
**IDOR** (Insecure Direct Object Reference), e.g. `GET /api/orders/999` from a
different customer. *Here:* orders, payments, addresses and reviews compare the
row's `usersid` against `req.user.id` and answer `403` on mismatch. See §12.

**Least privilege / secrets hygiene**
Only `VITE_*` values are inlined into the browser bundle (Vite replaces
`import.meta.env.VITE_*` **at build time**). Prefixing a secret with `VITE_` publishes
it to the world — that is why `server/.env` holds `JWT_SECRET`, `DB_PASSWORD` and
`VAPID_PRIVATE_KEY` and nothing on the frontend does.

**Input validation at the edge**
Reject malformed input before it reaches business logic. *Here:* Joi schemas in
`middleware/validationMiddleWare.js` and `middleware/productValidation.js`, run as
route middleware. Schema = shape/format; service = business rules, e.g. "quantity
must not exceed available stock".

---

## 6. Glossary C — Frontend Keywords

**Composition API**
Vue 3's function-based way to build components (`setup()`, `ref()`, `computed()`)
instead of Vue 2's options object. *Here:* used throughout — you will see `ref`,
`computed` and `onMounted` at the top of `<script setup>` blocks.

**SFC (Single-File Component)**
A `.vue` file holding `<template>`, `<script setup>` and `<style>` together.

**Pinia store**
A reactive container for shared state. A **state** is data, a **getter** is derived
data (a cached computed), an **action** is a method that changes state — often
asynchronously. *Here:* six stores in `src/stores/`: `auth`, `product`, `shop`,
`recentlyViewed`, `notifications`, `ui`.

**Composable**
A reusable function that encapsulates stateful logic, conventionally `useX()`.
*Here:* `src/composables/` — `ThemeToggle.js`, `useBreakpoint.js`,
`useScrollReveal.js`, `useToast.js`, `useWishlistStock.js`.

**Route guard**
A hook that runs before navigation and can allow, redirect or cancel it. *Here:*
`router.beforeEach` reads `to.meta.requiresAuth` / `to.meta.requiresAdmin` and
redirects anonymous or non-admin users.

**Route metadata (`meta`)**
Extra data attached to a route. *Here:* `meta.page` is a key into the shared
`PAGE_META` object, which is the single source of SEO titles/descriptions for both
the guard and the head manager.

**Lazy loading / dynamic import**
`() => import('../views/Home.vue')` instead of a top-level import, so the chunk
loads only when the route is visited. *Here:* **every** route is lazy, which keeps
the initial bundle small.

**Layout component**
A wrapper holding persistent chrome around `<RouterView>`. *Here:* exactly two —
`HomeLayout.vue` (navbar, footer, cart drawer, newsletter popup, cookie consent)
and `DashboardLayout.vue` (sidebar, topbar, notification bell). Chrome is declared
once instead of per page.

**Optimistic UI update**
Updating the interface before the server confirms, with rollback on failure. *Here:*
`markRead` in the notifications store only decrements the badge **after** the PUT
succeeds — a *pessimistic* update, chosen so the badge cannot drift from the server.

**`BroadcastChannel`**
A browser API for sending messages between same-origin tabs. *Here:* the mechanism
that keeps the unread badge identical in every open tab (`aliee-notifications`).
Where it is unavailable, the code falls back to a `localStorage` write, because the
`storage` event is delivered **only to other tabs** — the same semantics.

**`visibilitychange`**
Fired when a tab is hidden/shown. *Here:* background tabs have their timers
throttled, so the store re-syncs on becoming visible instead of trusting the timer.

**Debounce / throttle** *(concept worth knowing)*
Debounce waits for quiet before firing; throttle fires at most once per interval.
*Here:* the notification store does neither — it uses one **60-second interval plus
event-driven refreshes** (on load, on tab focus, on bell open). Fewer moving parts
than debouncing three independent pollers.

**IntersectionObserver**
A browser API that fires a callback when an element enters or leaves the viewport,
without scroll-event listeners. *Here:* used in two places to make the page feel
fast — `composables/useScrollReveal.js` (animate elements in as they are scrolled to)
and `components/LazyImage.vue` (defer loading an image until it is nearly visible).
Both guard with a feature check and fall back gracefully.

---

## 7. Glossary D — Database Keywords

**Primary key (PK)**
The unique identifier of a row. *Here:* note the non-standard naming — products use
`productsid`, and the schema consistently uses lowercase, unquoted, un-underscored
column names (`createdat`, `updatedat`, `password_hash` being the one exception).
**Always match the existing convention** rather than inventing camelCase; Postgres
folds unquoted identifiers to lowercase, so `createdAt` in SQL silently becomes
`createdat` and will not match a quoted `"createdAt"` column.

**Foreign key (FK)**
A column that must reference an existing row elsewhere, enforced by the database.
*Here:* deleting a product referenced by orders or wishlists raises Postgres error
code **`23503`**, which `productController.deleteProduct` translates into a `409`
with `suggestForceDelete: true` instead of leaking a raw driver error.

**Constraint / unique index**
A rule the database refuses to violate. *Here:* `schema_migrations.filename` is a
primary key, so a migration can never be recorded twice.

**View**
A stored query that behaves like a read-only table. *Here:* five baseline views —
`view_products`, `view_orders`, `view_order_detail`, `view_cart`, `view_users` —
plus `add_low_stock_view.sql` for the dashboard's low-stock widget.

**Index**
A lookup structure that makes filtered/sorted reads fast at the cost of write time.
*Here:* the baseline schema carries indexes alongside the 18 tables.

**Transaction (`BEGIN` / `COMMIT` / `ROLLBACK`)**
A group of statements that either all apply or none do. *Here:* the migration runner
wraps each file **and** its `schema_migrations` insert in one transaction, so a
half-applied migration is impossible; `setup.js` does the same for the base schema.

**Simple query protocol**
A node-postgres detail worth knowing: when you pass a string (not a parameter array)
to `client.query`, the whole multi-statement string executes in one round trip. That
is exactly what the migration runner relies on to run a whole `.sql` file at once.

**Parameterised query**
Passing values separately (`$1`, `$2`) instead of string-concatenating them. This is
what prevents **SQL injection**, because the driver never parses the value as SQL.
*Here:* the only place interpolation is unavoidable is `CREATE DATABASE`, where
`setup.js` quotes the identifier by hand (`quoteIdent`).

**Upsert**
Insert-or-update. *Here:* `PUT /api/products/:id/stock` "upserts product-level
stock" — one call covers both "set stock for the first time" and "change it".

**`pgcrypto`**
A Postgres extension for cryptographic functions. *Here:* present in the baseline
schema. Note the app still hashes passwords in Node with bcrypt, not in the DB.

**Baseline schema**
A snapshot of the original tables that migrations never created. *Here:*
`server/schema/000_base_schema.sql` is a `pg_dump --schema-only` snapshot of
**18 tables and 5 views**. It exists because `migrations/` is strictly *additive*:
it adds feature tables and columns but never created `products`, `users`, `category`,
`orders`, `cart`, `stock`, and so on. Without the baseline, the migrations alone
cannot produce a database the app can use.

---

## 8. Glossary E — Testing & Tooling Keywords

**Unit test**
Tests one function or module in isolation, with collaborators replaced. *Here:*
`server/tests/*.test.js` — `tokenService.test.js`, `cartService.test.js`,
`orderService.test.js`, and so on. Services are easy to unit test precisely because
SQL lives in a different layer.

**Integration test**
Tests several layers together, usually against real infrastructure. *Here:*
`server/tests/*.integration.test.js` (`product.integration.test.js`,
`api.endpoint.integration.test.js`) run real routes against a **real database**,
with a separate config (`vitest.integration.config.js`) and its own npm script.

**Mocking**
Substituting a fake implementation. *Here:* `dbpool.js` explicitly skips its startup
`SELECT 1` when `VITEST === 'true'`, so unit tests can import modules that transitively
import the pool without needing a database.

**Test environment exemptions**
Deliberate carve-outs so tests are deterministic. *Here:* `rateLimitMiddleware`
sets `skip: isTestEnv` so a suite that hammers `/api/auth/login` is not rate-limited
into failure. Worth knowing, because it means the limiters are *not* exercised
through those routes — `rateLimitMiddleware.test.js` exists for that reason.

**Supertest**
Drives an Express app over HTTP without binding a port. This works here because
`main.js` exports the app and only calls `app.listen` when not in a test environment.

**jsdom**
A JavaScript DOM implementation, so component and store tests can run in Node.
*Here:* configured in `vite.config.js` (`environment: 'jsdom'`) with
`test/setupTests.js` as the global setup file.

**Testing Library (`@testing-library/vue`)**
Encourages asserting on rendered output rather than component internals — tests that
survive refactors. *Here:* `vue-project/test/components/`.

**Deterministic vs. environment-dependent code**
`main.js` guards `app.listen` behind `isTestEnv`; `dbpool.js` guards its connection
check behind `VITEST`. Both exist so that importing the app never has side effects
the tests did not ask for. This is the pattern to copy for any new startup work.

---

## 9. Deep Dive: The Life of One Request

Trace an authenticated admin write — "save a product edit".

```
 1. Browser: axios PUT /api/products/12
    │  api.js request interceptor adds x-csrf-token (read from the csrf-token cookie)
    │  withCredentials: true  → the auth_token + csrf-token cookies ride along
    ▼
 2. Express (server/src/main.js), in registration order:
    helmet()            → security headers
    compression()       → gzip the response
    rateLimit(global)   → 200 / 15 min per IP   (after `trust proxy`, so IP is real)
    cors()              → origin allowlist + credentials
    express.json()      → parse body, 10 MB limit
    express.urlencoded()
    cookieParser()      → req.cookies
    csrfProtection      → compare cookie vs x-csrf-token on unsafe methods
    logger              → console.log timestamp + method + path
    ▼
 3. Route  (server/src/routes/productRoutes.js)
    router.put('/:id', protect, isAdmin, validateProduct, validate, updateProduct)
    │       ▲        ▲          ▲                                   ▲
    │       │        │          └─ Joi schema for the body           └─ controller
    │       │        └─ role_id must be 1 or 2
    │       └─ verify JWT, attach req.user = { id, role_id }
    ▼
 4. Controller  (productController.updateProduct)
    parses req.params/req.body → calls the service → picks the status code.
    No SQL, no rules.
    ▼
 5. Service  (services/productService.js)
    business rules: does the product exist, is the category valid, is the price sane.
    ▼
 6. Model  (model/products/productModel.js)
    the SQL. Runs on the shared pool from database/dbpool.js.
    ▼
 7. Response
    { success: true, message: 'Product updated successfully', data: {...} }
    ▼
 8. Client
    If the access token had expired this call would have returned 401 first; the
    response interceptor would have called POST /auth/refresh once (shared across
    concurrent 401s), then replayed this exact request with _retriedAfterRefresh = true.
```

**Why the middleware order matters:**

- `helmet` before anything that might leak a response.
- `rateLimit` **after** `trust proxy`, or every client looks like the reverse proxy
  and one user's traffic throttles everyone.
- `cookieParser` before the CSRF middleware, which reads `req.cookies`.
- CSRF **before** the routes, but after the parsers, so the body is already consumed
  and the client's header can be compared.
- The 404 handler and global error handler are registered **last** — Express matches
  in order, so a 404 declared earlier would swallow every route below it.
- `trust proxy` is set **only** in production, because in development there is no
  proxy and trusting `X-Forwarded-For` would let a client spoof its own IP and
  bypass rate limiting entirely.

**Lightweight reads that bypass the whole stack:** `GET /health` (liveness),
`GET /` (a tiny endpoint index), `GET /robots.txt`, `GET /sitemap.xml` — all defined
directly in `main.js`.

---

## 10. Deep Dive: Authentication & Sessions

### The two-cookie design

| | `auth_token` | `refresh_token` |
|---|---|---|
| Form | JWT (`{ id, role_id }`, signed) | Opaque, 32 random bytes (hex) |
| Stored server-side | No — self-verifying | Yes, **SHA-256 hash only** in `refresh_tokens` |
| Lifetime | 15m (`ACCESS_TOKEN_EXPIRES_IN`) | 7d, or 30d with "Remember me" |
| Cookie scope | `path: /` | `path: /api/auth` |
| Sent on | every request | only auth requests |
| Revocable | No (expiry only) | Yes — `revoked_at` / `is_active` |

The scope split is the interesting part: because the refresh cookie is limited to
`/api/auth`, it is not attached to ordinary API calls. A stolen request log or a
compromised endpoint never sees your long-lived credential.

### The lifecycle

```
login ──► issueTokens(userId, roleId, rememberMe)
          ├─ generate refresh token (random) ──► store SHA-256(hash), expiry, remember flag
          ├─ sign access token (JWT, 15m)
          └─ set both cookies

request ──► protect: verify signature AND expiry ──► req.user = { id, role_id }

expired (401) ──► POST /api/auth/refresh
                  └─ rotateRefreshToken(rawToken)
                     ├─ hash it, look up the row
                     ├─ row missing?              → null   (reject)
                     ├─ row revoked or expired?   → revoke ALL user sessions, null
                     ├─ row inactive?             → revoke ALL user sessions, null
                     ├─ revoke this row, keep it for reuse detection
                     └─ issueTokens(...)          → new pair, both cookies reset

logout      ──► revoke this refresh row (row kept, so reuse is detectable)
logout-all  ──► revoke every refresh row for the user
password change ──► same as logout-all
```

### Why the client-side flow looks the way it does

`vue-project/src/api/api.js` handles 401 centrally, and three details matter:

- **Concurrent 401s share one refresh.** A module-level `refreshPromise` means five
  parallel requests that all expire trigger **one** refresh call, not five. Without
  it you would race five rotations and revoke your own session via reuse detection.
- **No infinite loops.** The refresh call itself is sent with `_skipAuthRefresh`, and
  replays are marked `_retriedAfterRefresh` so a request is retried at most once.
- **Login failures are not redirects.** `/auth/login` and `/auth/register` returning
  401 is *expected* (wrong password); the interceptor refuses to treat those as
  session expiry, and it will not redirect while you are already on an auth page.

### Frontend session bootstrap

`vue-project/src/main.js` calls `authStore.init()` **before** `app.mount('#app')`.
`init()` hits `/api/auth/me` (which works purely off the httpOnly cookie), loads
permission keys, and merges an anonymous wishlist into the server one. It always sets
`initialized = true` in a `finally`, even on failure.

That flag is what fixes a subtle bug: `router.beforeEach` returns early while
`initialized` is false, so a refresh on a protected page does not get redirected to
`/login` before the session has been confirmed. `App.vue` shows a loading overlay
until then.

---

## 11. Deep Dive: CSRF Protection

**The problem.** Cookies are attached to requests automatically. If an attacker gets
your browser to submit a form to `alieeshop.com/api/products/12` while you are logged
in, your `auth_token` cookie goes with it and the request looks legitimate. The
attacker cannot *read* the response (SOP), but a delete or an edit does not need to
be read to hurt.

**The fix used here — double-submit cookie.** Implemented in
`server/src/middleware/csrfMiddleware.js`:

```
GET /anything
  └─ no csrf-token cookie?  → set one: crypto.randomUUID(), httpOnly: false,
                              sameSite: 'lax', secure in production, maxAge 24h

PUT /api/products/12
  ├─ cookie csrf-token missing?        → 403 "CSRF token missing"
  ├─ header x-csrf-token missing?      → 403 "CSRF token missing"
  ├─ cookie !== header?                → 403 "CSRF token mismatch"
  └─ match                             → next()
```

Client side, `api.js` reads the cookie with a regex and copies it into the header —
but only for methods outside `get`/`head`/`options`, mirroring the server's safe-method
list.

**Why this works.** Only JavaScript running on your own origin can read the
`csrf-token` cookie and therefore set the matching header. A cross-site form cannot
read cookies and cannot set custom headers, so it cannot produce a matching pair.

**Why the CSRF cookie is *not* httpOnly.** Deliberately the opposite of the auth
cookies: something has to be readable for double-submit to function. The token is
random and useless on its own — it grants nothing without the session cookie, so
exposing it costs nothing.

**Why `sameSite: 'lax'` is a second layer, not the only one.** `lax` already blocks
cookies on cross-site POSTs in modern browsers. The double-submit token covers older
browsers and any future relaxation of that default.

---

## 12. Deep Dive: Authorization in Two Layers

Authorization is enforced twice, and the distinction is the point.

### Layer 1 — Route level: may this *kind* of user call this endpoint?

`server/src/middleware/authMiddleWare.js` exports three guards:

| Guard | Rule | Where |
|---|---|---|
| `protect` | Valid non-expired JWT → `req.user = { id, role_id }`; else `401` | Every private route |
| `isAdmin` | `role_id === 1 \|\| role_id === 2`; else `403` | All admin writes |
| `isUser` | `role_id === 3`; else `403` | Customer-only endpoints |

From `README.md`, admin-only covers all of `/api/users` except `/profile`,
`/api/roles`, `/api/dashboard`, image upload, and the product / category / variant /
stock / discount writes, plus `/api/payments/methods/*`.

### Layer 2 — Row level: may this user touch *this specific row*?

The route guard cannot answer this. `GET /api/orders/999` is a legitimate endpoint
for any logged-in user; what matters is whether order 999 belongs to *them*. Without
this check you have an **IDOR** — you can read someone else's order by changing the
number.

| Rule | Where |
|---|---|
| Self only — ids in the body/URL are ignored, `role_id` is read from the **stored row**, so a user cannot promote themselves | `PUT /api/users/profile` |
| Owner or admin — compare the row's `usersid` against `req.user.id`, `403` otherwise | Orders, payments, addresses, reviews |
| Implicitly scoped — queries filter by `req.user.id`; cart mutations additionally verify the item belongs to the caller's cart | Cart, wishlist, notifications |

`password_hash` is never returned by any user endpoint.

### The `role_id` numbering, and a real inconsistency

The role scheme is **1 = superadmin, 2 = admin, 3 = customer**.

But the two sides disagree about what "admin" means for the dashboard:

| Place | Check | Effect |
|---|---|---|
| Backend `isAdmin` | `role_id === 1 \|\| role_id === 2` | role 2 passes backend checks |
| `stores/auth.js` getter `isAdmin` | `role_id <= 2` | role 2 treated as admin |
| `stores/notifications.js` `isAdmin()` | `role_id <= 2` | role 2 uses the **admin** notification endpoints |
| `router/index.js` guard | `Number(user?.role_id) === 1` | role 2 is **bounced from `/admin/*`** |

So a `role_id = 2` account can pass every server-side admin guard and is handed the
admin notification endpoints by the store — yet the router will not let it into the
dashboard. The intent appears to be a split between superadmin (1) and admin (2),
but the three frontend checks were not written to the same rule. Pick one definition
and apply it in all four places.

---

## 13. Deep Dive: The Database & Migrations

### Two artifacts, one job

The schema reaches a database through two different mechanisms, and understanding why
prevents a lot of confusion:

| Artifact | What it is | When it is applied |
|---|---|---|
| `server/schema/000_base_schema.sql` | `pg_dump --schema-only` snapshot: **18 tables, 5 views**, indexes, FKs, `pgcrypto` | `npm run setup`, and **only** if the database has no `products` table |
| `server/migrations/*.sql` | 13 ordered, additive files | `npm run migrate`, tracked in `schema_migrations` |

The migrations are strictly additive — they create *feature* tables and add columns.
They never created `products`, `users`, `category`, `orders`, `cart`, `stock`, or the
other core tables, because those predate the migration system. That is exactly why
the baseline file exists: on its own, `migrations/` cannot build a runnable database.

### The migration runner (`server/migrate.js`)

```
ensureTrackingTable()      CREATE TABLE IF NOT EXISTS schema_migrations
                           (filename PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
getAppliedMigrations()     SELECT filename  → Set
listMigrationFiles()       readdir + filter *.sql + sort()   ← order = filename order
applyMigration(file)       BEGIN
                             client.query(entire file as one string)
                             INSERT INTO schema_migrations (filename) VALUES ($1)
                           COMMIT   /   ROLLBACK on error, message prefixed with filename
```

Design notes worth stating out loud:

- **Ordering is filename order.** `add_cash_on_delivery.sql` runs before
  `add_cod_fee_column.sql` as a side effect of `Array.prototype.sort`. There is no
  numeric prefix, so this is fragile — a new file whose name sorts before a dependency
  will run too early. (The one deliberate exception is `remove_password_hash_triggers.sql`,
  which is idempotent and whose late position is fine.)
- **Read-modify-write safety.** Whole file + bookkeeping row in one transaction means
  you can never have "the table exists but the migration is unrecorded".
- **`npm run migrate -- --status`** lists applied vs pending without touching anything
  — the first thing to run when someone reports a broken environment.
- The runner imports the app's own pool, so it reads the same `DB_*` values the app
  does. One source of truth for connection settings.

### One-command setup (`server/setup.js`)

```
1/4 Database      connect to a maintenance DB ("postgres"), CREATE DATABASE if absent
                  (CREATE DATABASE cannot be parameterised → identifier quoted by hand)
2/4 Base schema   only if `products` does not exist; whole file inside BEGIN/COMMIT
3/4 Migrations    spawn `node migrate.js` as a child process with the same env
4/4 Seed          skip if products is non-empty, unless --force-seed
                  then print row counts (cosmetic — never fails setup)
```

Two deliberate choices: migrations run as a **child process** rather than an import,
because `migrate.js` calls `process.exit()` on import — spawning keeps one source of
truth for how migrations are tracked. And the base schema check makes setup
**idempotent**, so it is safe to run on a database you have been using for weeks.

### Schema conventions to respect

- **Lowercase, unquoted identifiers.** `productsid`, `createdat`, `updatedat`,
  `usersid`, `role_id`. Postgres folds unquoted identifiers to lowercase, so mixing
  in camelCase will silently disagree with the actual column names.
- **Migrations are append-only.** Never edit an applied file — every database that
  already ran it will drift from the repository. Add a new file instead.
- **Hashing is an application concern.** bcrypt in Node only; the DB-side triggers
  that double-hashed passwords were removed on purpose.

---

## 14. Deep Dive: Frontend State & the Notification Sync Problem

### Store responsibilities

| Store | Owns |
|---|---|
| `auth.js` | `user`, `permissions[]`, `error`, `loading`, `initialized`; getters `isAuthenticated`, `isAdmin`, `isSuperadmin`, `can/canAny/canAll`; actions `init`, `login`, `register`, `logout`, `logoutAll` |
| `product.js` | Catalog, categories, variants, stock, discounts, filters |
| `shop.js` | Cart contents, checkout totals — **and the wishlist merge on login** (`mergeAndSyncWishlistOnLogin`) |
| `recentlyViewed.js` | Recently seen products |
| `notifications.js` | Unread count + recent items, cross-tab sync, polling |
| `ui.js` | Sidebar, drawer, search overlay, persisted UI preferences |

Note: there is no separate `wishlist` store — wishlist logic lives in `shop.js`, with
`api/wishlistApi.js` as its HTTP layer. `PROJECT_OVERVIEW.md` lists it as its own
store; the code disagrees.

### The unread-badge problem, and the pattern to copy

Four surfaces show the same number: the storefront navbar bell, the dashboard bell,
and the two full notification pages. The naive implementation gives each its own
fetch and its own timer, and they drift — one shows 3, another shows 1, and a third
tab shows a stale 5.

`src/stores/notifications.js` solves it by making **one store the single owner** of
the count:

- **One poll, not four.** A 60-second interval, plus immediate refreshes on load, on
  tab focus (`visibilitychange`) and whenever a bell is opened.
- **Cross-tab consistency.** Every change is published over
  `BroadcastChannel('aliee-notifications')`; tabs without it fall back to a
  `localStorage` write, whose `storage` event is delivered only to *other* tabs —
  the same semantics, achieved differently.
- **No message ping-pong.** `setCount` only publishes when the value actually
  changed, so two tabs cannot bounce the same count back and forth forever.
- **Clamped and cleared.** The count can never go negative, and `reset()` clears it
  on logout.
- **Server-first.** `markRead` decrements only after the PUT succeeds; a rejected
  request leaves the badge untouched rather than lying about it.
- **Module-level state, not store state.** `channel`, `detachSync`, `pollTimer` and
  `started` live outside the store definition so they survive component remounts, and
  `start()` is idempotent — several components may call it safely.

The reusable lesson: **cross-cutting UI state gets one owner with one timer**, and any
new shared state should follow this shape instead of adding another poller.

---

## 15. Deep Dive: SEO, Sitemap & Web Push

### Frontend meta tags (Unhead)

`src/head.js` builds a shared head instance with `createUnhead()` and then manually
`app.provide(headSymbol, headInstance)` — needed because `createUnhead()` does not by
itself wire up Vue's provide/inject for `useHead()`.

`router.afterEach` then applies `PAGE_META[to.meta.page]`: `title`, `description`,
`keywords` (when present), `og:title/description/image/url/type`,
`twitter:title/description/image/card`, plus a `canonical` link.

Two details that show care:

- **Disposal.** The previous route's entries are disposed before new ones are pushed,
  so tags do not accumulate across navigations.
- **Opt-out.** `SEO_SKIP_PAGES = ['ProductDetail', 'blogPost']` — those two set their
  own dynamic tags, so the generic pass would overwrite them with placeholders.

### Server-generated `robots.txt` and `sitemap.xml`

Both live directly in `server/src/main.js`:

- **`/robots.txt`** allows everything except `/admin/`, `/api/`, `/login`,
  `/register`, `/forgotPassword`, `/userprofile`, and points at
  `${FRONTEND_URL}/sitemap.xml`.
- **`/sitemap.xml`** combines 11 static pages with a **live query** for active
  products — `SELECT productsid, productname, createdat FROM products WHERE status = 'active'`.
  The product `status` column is therefore not cosmetic: it gates search-engine
  visibility. The query is wrapped in its own try/catch, so if the database is
  unreachable the response degrades to the static sitemap instead of a 500.

**A deployment subtlety worth knowing:** these endpoints are served by the **API**, but
the sitemap contains `FRONTEND_URL` links. In development that means the API's copy
lives at `localhost:5001/sitemap.xml` while `FRONTEND_URL` points at `localhost:3001`.
In production the two must be the same public origin — typically the API is reverse
proxied under the frontend domain — or search engines will be handed a sitemap of
URLs on the wrong host.

### Web push

Optional, and disabled unless all three VAPID variables are set — there is
deliberately **no placeholder key**, because subscribing with a fake key succeeds and
then silently never delivers, which is worse than a clear failure
(`GET /api/dashboard/vapid-public-key` answers `503` and the settings page says push
is unavailable).

Every notification is created through a **single helper** in `dashboardService.js`:

```js
const createNotification = async ({ type, message, link = null, userId = null }) => {
  const notification = await NotificationModel.createNotification({ ... });   // 1. write the row
  const payload = { title, body: message, url: link || fallback, tag: `${type}-${id}` };
  const dispatch = userId
      ? pushService.sendPushToUser(userId, payload)          // personal
      : pushService.sendPushToAllSubscribers(payload);        // broadcast to all admins
  dispatch.catch(err => console.error('[Push] Dispatch failed:', err.message));  // 2. best effort
  return notification;
};
```

The ordering is the design: **row first, push second, failure only logged.** A push
provider outage can never lose a notification, because persistence already happened.
Subscriptions the push service reports as gone (`404`/`410`) are deleted
automatically; transient failures are simply retried by the next notification.

`Notification` rows with a `userid` are personal; rows without one are admin
broadcasts. The frontend store mirrors that split exactly — `isAdmin()` chooses
between `/dashboard/notifications*` and `/notifications*` — which is why the
role mismatch in §12 matters here too.

---

## 16. Per-File Walkthrough

Every file that matters, in roughly the order you should meet it, grouped by layer so
the boundaries stay visible. Each entry says what the file is **and what to look for**.

> Not listed: `node_modules`, `dist`, `.git`, editor config, and the ~13 static policy
> pages under `views/pages/` (they are content, not logic).

### Documentation

**`README.md` — the operating manual.**
Install steps, env variables, the migration list, the API overview table, the full
session/rate-limit reference, testing, and a production checklist. Read it to *run*
the project.

**`PROJECT_OVERVIEW.md` — the shape of the system.**
Repository layout, the request lifecycle, frontend/backend architecture, conventions,
and a copy-paste CV entry with a claim-to-evidence map. Read it to *navigate* the code.

**`EXPLAIN.md` — this file.** Read it to understand *why* anything is the way it is.

**`server/schema/README.md` — baseline schema notes.**
Explains how `000_base_schema.sql` was captured and how to regenerate it if the core
tables ever change.

---

### Backend — entry points and infrastructure

**`server/package.json` — scripts and dependencies.**
`"type": "module"`, so every file is native ESM. Scripts worth knowing: `dev`
(`node --watch --env-file=.env`), `start`, `start:prod` (no `.env`, real env vars),
`setup`, `migrate`, `test` (unit only), `test:integration`.

**`server/src/main.js` — app assembly. Read this one first.**
It is the map of the whole API: middleware in order (Helmet → compression → rate
limit → CORS → body parsers → cookie parser → CSRF → logger), all **16**
`app.use('/api/<name>', …)` mounts, `/`, `/health`,
`/robots.txt`, `/sitemap.xml`, then the 404 handler, then the global error handler.
Two details to notice: `app.set('trust proxy', 1)` is **production-only** (so rate
limiting sees real client IPs behind a proxy and cannot be spoofed in dev), and
`app.listen` is wrapped in an `isTestEnv` check so importing the app in a test has no
side effect. *It is also the one place outside `model/` with raw SQL* (the sitemap
query).

**`server/src/database/dbpool.js` — the single database connection pool.**
One `Pool` (`max: 10`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`,
`ssl` when `DB_SSL === 'true'`). Every model imports this. On startup it probes with
`SELECT 1` and calls `process.exit(1)` if the database is unreachable — but skips the
probe entirely when `VITEST === 'true'`, which is what lets unit tests import models
without a database.

**`server/migrate.js` — the migration runner.**
Creates `schema_migrations` if absent, lists `.sql` files sorted by filename, skips
anything already recorded, and applies each file **and its bookkeeping insert inside
one transaction**. Supports `--status`. Look for the deliberate use of the simple
query protocol (the whole file is sent as one string) and the error message being
prefixed with the failing filename.

**`server/setup.js` — one-command fresh machine.**
Four steps: create the database via a maintenance connection (`CREATE DATABASE`
cannot be parameterised, so `quoteIdent` escapes it by hand), apply the base schema
**only if** no `products` table exists, spawn `migrate.js` as a **child process**
(because `migrate.js` calls `process.exit()` on import), then seed unless the products
table is already populated. Flags: `--no-seed`, `--force-seed`.

**`server/schema/000_base_schema.sql` — the baseline.**
A `pg_dump --schema-only` snapshot: **18 tables** (`products`, `users`, `category`,
`orders`, `orderitems`, `payments`, `paymentmethod`, `cart`, `cartitems`, `stock`,
`stocklog`, `variants`, `variantattribute`, `variantattributevalue`,
`variantoptionvalue`, `productimages`, `discounts`, `roles`), **5 views**
(`view_products`, `view_orders`, `view_order_detail`, `view_cart`, `view_users`),
indexes, foreign keys, and the `pgcrypto` extension. It exists because migrations are
additive and never created these.

**`server/seed_products.sql` — sample catalog.**
Sample categories, products, variants and stock. Note it opens and commits **its own
transaction**, which is why `setup.js` can hand it straight to `client.query`.

---

### Backend — middleware (`server/src/middleware/`)

**`authMiddleWare.js` — authentication and role gates.** (Yes, the filename
capitalises “Ware”.) Exports three guards:
- `protect` — accepts a `Bearer` header **or** the `auth_token` cookie, verifies the
  JWT signature *and* expiry, attaches `req.user = { id, role_id }`, else `401`.
- `isAdmin` — `role_id === 1 || role_id === 2`.
- `isUser` — `role_id === 3`.

**`csrfMiddleware.js` — double-submit CSRF.**
On `GET`/`HEAD`/`OPTIONS` it issues a `csrf-token` cookie (`crypto.randomUUID()`,
`httpOnly: false` on purpose, `sameSite: 'lax'`, 24 h) if absent. On unsafe methods it
compares the cookie against the `x-csrf-token` header and answers `403` for missing or
mismatched. See §11 for why the cookie must be readable.

**`rateLimitMiddleware.js` — the two endpoint-specific limiters.**
`authLimiter` (10 **failed** attempts / 15 min — `skipSuccessfulRequests: true`, so a
shared IP is not locked out by someone else) and `refreshLimiter` (60 / 15 min). Both
are disabled under test via `skip: isTestEnv`. The global 200/15 min limiter lives in
`main.js`, not here.

**`validationMiddleWare.js` — Joi schemas for people.**
Registration, login and profile-update schemas, each field carrying custom
`.messages()` so the API returns human-readable errors instead of Joi internals.

**`productValidation.js` — Joi schemas for the catalog.**
Product, category, variant, stock, discount, pagination and bulk-product schemas, plus
the generic `validate` middleware that turns a schema result into a `400`.

---

### Backend — routes (`server/src/routes/`)

All 16 are mounted under `/api/<name>` in `main.js`. The pattern is always
`method, path, …guards, …validators, controller`.

| File | Base path | Notable |
|---|---|---|
| `authRoutes.js` | `/api/auth` | The rate-limited surface: `register`/`login` use `authLimiter`, `refresh` uses `refreshLimiter`. `logout` is unguarded on purpose; `logout-all` and `me` require `protect` |
| `userRoutes.js` | `/api/users` | `PUT /profile` is declared **before** `PUT /:id`; everything except `/profile` is `isAdmin` |
| `productRoutes.js` | `/api/products` | The biggest file. Order-sensitive: every single-segment GET (`/search`, `/featured`, `/new-arrivals`, `/coming-soon`, `/best-sellers`, `/by-tag`, `/categories`, `/discounts`) is declared **before** `GET /:id`, which would otherwise swallow it — the file comments say so explicitly |
| `cartRoutes.js` | `/api/cart` | Every route is `protect`; items are addressed by `cartItemId` |
| `orderRoutes.js` | `/api/orders` | Cross-wires controllers: `/:id/pay`, `/:id/payments` and `/:id/mark-paid` are **paymentController** handlers, only `create`/`get`/`status` are orderController's |
| `paymentRoutes.js` | `/api/payments` | `/methods` is protected, `/methods/all` and the method CRUD are `isAdmin` |
| `wishlistRoutes.js` | `/api/wishlist` | Includes `POST /sync` for merging an anonymous wishlist after login |
| `reviewRoutes.js` | `/api/reviews` | Reads are mostly public, writes `protect`, `/all` and `/pending` and moderation are `isAdmin` |
| `addressRoutes.js` | `/api/addresses` | Self-scoped CRUD |
| `shippingRoutes.js` | `/api/shipping` | Fully public: rate quotes and address validation |
| `dashboardRoutes.js` | `/api/dashboard` | Almost all `isAdmin`, **except** `/notification-preferences`, deliberately not admin-gated so customers can manage their own |
| `settingsRoutes.js` | `/api/settings` | `GET` protected, `PUT` `isAdmin` |
| `roleRoutes.js` | `/api/roles` | Entirely `isAdmin` — roles and permissions CRUD |
| `userNotificationRoutes.js` | `/api/notifications` | The customer half of the bell; the literal `GET /recent` and `/unread-count` are declared before `GET /:id` so they are not parsed as ids |
| `imageRoutes.js` | `/api/images` | Upload/delete are `isAdmin`; the listing is public |
| `newsletterRoutes.js` | `/api/newsletter` | Single public `POST /subscribe` |

---

### Backend — controllers (`server/src/controller/`)

Thin by design: read `req`, call a service, choose a status code. **A controller with
SQL or a business rule in it is a bug.**

**`userController.js` — where authentication actually lives.**
This is the surprise in the layout: `registerUser`, `loginUser`, `logoutUser`,
`logoutAllSessions`, `refreshAccessToken`, `getMe`, `checkUsername`, `checkEmail`,
`updateProfile` (the self-only one that ignores `role_id` from the body) and the admin
user CRUD are **all here**. `authController.js` only holds `getUserPermissions`.

**`productController.js` — the largest surface (~50 handlers).**
Products, categories, images, variants, stock, stock history, bulk operations and
discounts. Look for the error translation on delete: Postgres `23503` (foreign key
violation) becomes a `409` with `suggestForceDelete: true` rather than a raw driver
error.

**`dashboardController.js` — everything the admin screens read.**
Stats, analytics, reports, activity log, notification CRUD, push subscribe/unsubscribe
and the VAPID public key. Most handlers are one-line delegations to services.

**`orderController.js` / `paymentController.js` — the money path.**
Orders are created from the cart (`createOrder`), status changes are admin-only, and
payment recording/marking are split into the payment controller but mounted under
`/api/orders` for the order-scoped actions.

**`cartController.js` / `wishlistController.js` / `addressController.js` — self-scoped CRUD.**
Short files; every handler passes `req.user.id` down so ownership is enforced in the
service/model rather than trusted from the request.

**`reviewController.js` — read/write/moderation split.**
Submission, per-product and per-user reads, author edit/delete, plus admin-only
listing, pending queue and moderation.

**`roleController.js` — RBAC administration.**
Roles CRUD, permissions CRUD, and `updatePermissions` which replaces a role's
permission set.

**`imageController.js` — the only Multer consumer.**
Single/multiple upload, delete, and listing, all delegated to
`services/storageService.js`, which talks to the object store (`products/` prefix)
over the S3 API. The maintenance scripts in `server/scripts/` (`images:migrate`,
`images:cache`) move legacy local files into the bucket and backfill their
`Cache-Control`.

**`settingsController.js` / `shippingController.js` / `newsletterController.js` / `userNotificationController.js`**
Small, focused files: store config read/update, shipping quotes and address
validation, newsletter subscribe, and the customer notification endpoints.

---

### Backend — services (`server/src/services/`)

Where business rules live, and where the unit tests point. A service may orchestrate
several models but must not contain SQL.

**`tokenService.js` — token policy.**
The most important file for understanding auth. Owns the TTL defaults (15 m / 7 d /
30 d), `parseDuration` (handles `ms|s|m|h|d`, plain numbers as seconds like
`jsonwebtoken` does), `hashRefreshToken` (SHA-256), `signAccessToken`, `issueTokens`,
`rotateRefreshToken` (with the reuse-detection branch that revokes every session) and
`revokeRefreshToken` / `revokeAllUserRefreshTokens`.

**`userService.js` — accounts.**
Lookups by id/email/username/identifier, `register` and `login` (the real credential
flow, including bcrypt `verifyPassword`), profile updates and the existence checks
used by the signup form.

**`productService.js` — catalog rules.**
The largest service: `createCompleteProduct` (product + images + variants + stock in
one call), pagination, search, stock increment/decrement, low-stock queries, discount
application and bulk creation.

**`orderService.js` — the transaction-shaped part of checkout.**
`createOrderFromCart(userId)` turns a cart into an order and its line items;
`getOrder(userId, orderId, roleId)` is **role-aware**, which is how an admin can read
any order while a customer can only read their own.

**`cartService.js` — cart rules on top of the cart model.**
`getOrCreateCart` behaviour, variant-aware item identity, quantity updates, clear.

**`paymentService.js` — money and authorization.**
Every method-CRUD function takes a `roleId` parameter, so "who may change payment
methods" is decided in the service, not only in the route guard. Also
`recordPayment` and `markPaymentAsPaid`.

**`dashboardService.js` — the biggest file in the project (~1,190 lines).**
Analytics, reports, activity log, global search, notification CRUD, and the
**notification + push helper** described in §15 — plus the `notify*` wrappers
(`notifyNewOrder`, `notifyNewUser`, `notifyLowStock`, `notifyNewProduct`,
`notifyOrderStatusChange`) that other services call. If you are adding any new
notification, call one of these rather than writing the row yourself.

**`pushService.js` — VAPID and delivery.**
`getVapidConfig` returns `null` unless all three VAPID variables are set (there is no
placeholder key), `isPushConfigured`, `sendToSubscriptions` (prunes `404`/`410`
endpoints), `sendPushToUser` and `sendPushToAllSubscribers`.

**`reviewService.js` — ratings and moderation.**
Creation, per-product/per-user reads, pending queue, moderation, and author-or-admin
edit/delete.

**`roleService.js` — RBAC rules.**
Roles and permissions CRUD, `updateRolePermissions`, and `seedDefaultPermissions`
which bootstraps the permission catalogue. Audit-friendly: most mutators accept a
`performedBy` argument that defaults to `'system'`.

**`settingsService.js` / `shippingService.js` / `addressService.js` / `wishlistService.js` / `userNotificationService.js`**
Small rule sets: store config (with a `roleId` check), shipping rate calculation from
subtotal/item count/region, self-scoped address CRUD, wishlist toggle/sync, and the
customer notification queries.

---

### Backend — models (`server/src/model/`)

The **only** place SQL is written. All of them import the shared pool.

| File | Owns |
|---|---|
| `userModel.js` | `users` reads/writes, `password_hash` handling, existence checks |
| `refreshTokenModel.js` | `refresh_tokens` — create (hash only), lookup by hash, revoke one, revoke all for a user, prune expired |
| `products/productModel.js` | The biggest model: products, images, variants, variant options, stock, stock levels, low-stock query, discounts |
| `products/categoryModel.js` | `category` CRUD plus `categoryExists` / `getCategoryByName` |
| `products/stockLogModel.js` | `stocklog` writes and the per-product stock history used by `/api/products/:id/stock/history` |
| `orderModel.js` | `orders` / `orderitems`; several functions accept an optional `client` so they can join a caller's transaction |
| `paymentModel.js` | `paymentmethod` and `payments`, status transitions |
| `cartModel.js` | `getOrCreateCart`, cart items, quantity updates |
| `wishlistModel.js` | Wishlist items and bulk add (used by the login merge) |
| `reviewModel.js` | Reviews, rating summary, moderation state, `ensureTable` |
| `notificationModel.js` | **The busiest file in this layer** — notifications, audit logs, notification preferences and push subscriptions. Also exports `ensureTable`, `ensureAuditTable`, `ensurePrefsTable`, `ensurePushTable` |
| `roleModel.js` | `roles`, `permissions`, role-permission assignments, `tableExists` |
| `settingsModel.js` | Single-row store settings, `upsertSetting` / `bulkUpsertSettings` |
| `addressModel.js` | Address CRUD, always scoped by `userId` |
| `newsletterModel.js` | Subscribers, plus `ensureTable` |

> **Watch for the `ensure*` pattern.** `notificationModel`, `reviewModel` and
> `newsletterModel` create their own tables at runtime (`CREATE TABLE IF NOT EXISTS`)
> instead of relying on a migration. It works and keeps those features
> self-contained, but it means the schema has **two** sources of truth — migrations
> for most tables, model code for these — and that a read path can trigger DDL on a
> cold database.

---

### Frontend — bootstrap and infrastructure

**`vue-project/package.json`.** Scripts: `dev`, `build`, `preview`, `test`.

**`vue-project/vite.config.js` — dev server and build.**
The dev proxy (`/api` → `:5001`), the `@` → `src` alias, `manualChunks` (splitting `vue`,
`lucide-vue-next` and `vendor`), and the Vitest block (`jsdom`, globals,
`test/setupTests.js`). Devtools are imported conditionally so they never ship.

**`vue-project/src/main.js` — app bootstrap.**
`createApp` → Pinia → router → the SEO head plugin → **`authStore.init()` → mount**.
That ordering is the fix for the stale-redirect bug: `init()` reads the session from
`/api/auth/me` (via the httpOnly cookie) *before* the router guard runs.

**`vue-project/src/App.vue`.**
Mount point plus the auth loading overlay that hides the app until
`authStore.initialized` is true.

**`vue-project/src/head.js` — SEO plumbing.**
Builds one Unhead instance with `createUnhead()`, then `app.provide(headSymbol, …)`
by hand, because `createUnhead()` does not wire up Vue's provide/inject on its own.
Exports `headInstance` (used by the router) and the `seoHead` plugin.

**`vue-project/src/router/index.js` — routes, guards and SEO metadata.**
Read it for three things: the `PAGE_META` object (the single source of titles/
descriptions), the route tree (two layout parents — `HomeLayout` and
`DashboardLayout` — with **every** page lazy-loaded), and the two hooks:
`beforeEach` (auth/admin guards, deferring while `!initialized`) and `afterEach`
(applies `PAGE_META`, disposing the previous entries first).

**`vue-project/src/api/api.js` — the axios client. The frontend file to understand first.**
`withCredentials: true`, a **request** interceptor that copies the `csrf-token` cookie
into `x-csrf-token` on unsafe methods, and a **response** interceptor implementing the
401 → refresh → replay-once flow with a shared `refreshPromise` so concurrent 401s
trigger a single refresh.

**`vue-project/src/api/*.js` — one module per backend resource.**
`authApi`, `userApi`, `cartApi`, `orderApi`, `paymentApi`, `reviewApi`, `roleApi`,
`settingsApi`, `shippingApi`, `wishlistApi`, `dashboardApi`, `addressApi`, plus
`api/products/` which splits the catalog into `productApi`, `categoryApi`,
`variantApi`, `stockApi`, `discountApi` and `imageApi`. These mirror the 16 route files
almost one-for-one — if the backend gains a route file, this is where its counterpart
goes.

**`vue-project/src/assets/main.css`.**
Tailwind v4 entry plus the Geist font and theme tokens.

---

### Frontend — stores (`vue-project/src/stores/`)

**`auth.js` — session, permissions, role.**
State `user`, `permissions`, `error`, `loading`, `initialized`. Getters
`isAuthenticated`, `isAdmin` (`role_id <= 2`), `isSuperadmin` (`=== 1`), and the
permission helpers `can` / `canAny` / `canAll`. Actions `init`, `login`, `register`,
`logout`, `logoutAll`, `resetLocalSession`. Note that `login`/`init` also merge the
anonymous wishlist via the shop store, and that `init` sets `initialized` in a
`finally` so a failed session check can never hang the app.

**`shop.js` — cart *and* wishlist.**
One store holds both (there is no separate `wishlist` store). Cart lines are keyed by
id **plus** a stringified variant, totals are `computed`, the cart persists to
`localStorage`, and `mergeAndSyncWishlistOnLogin` reconciles an anonymous wishlist
with the server one.

**`product.js` — the catalog cache.**
Products, categories, variants, stock, discounts and the filter state the listing page
binds to.

**`notifications.js` — the unread badge. The best pattern in the frontend.**
One owner for the count across four UI surfaces, one 60-second poll plus
load/focus/bell-open refreshes, `BroadcastChannel` cross-tab sync with a
`localStorage` fallback, broadcasting only on real change, and clamping at zero. Idle
promises and timers live at module scope so `start()` is idempotent. See §14.

**`recentlyViewed.js` / `ui.js` — small, satisfied singletons.**
Recently viewed products; and sidebar/drawer/search state with a versioned
`localStorage` key (`alie_ui_v1`) so a future shape change can be migrated instead of
crashing on old data.

---

### Frontend — composables (`vue-project/src/composables/`)

| File | Provides |
|---|---|
| `useBreakpoint.js` | Reactive viewport breakpoints for responsive layout logic |
| `useToast.js` | Imperative toast API used by `ToastContainer.vue` |
| `useScrollReveal.js` | `IntersectionObserver`-driven reveal-on-scroll with a feature check |
| `ThemeToggle.js` | Dark/light theme state and persistence |
| `useWishlistStock.js` | Wishlist-aware stock state (out-of-stock handling on saved items) |

---

### Frontend — layouts

**`HomeLayout.vue`** — the storefront shell: navbar, footer, cart drawer, newsletter
popup, cookie consent, back-to-top. Chrome declared **once** for its 24 child routes.
**`DashboardLayout.vue`** — the admin shell: sidebar, topbar, notification bell.

---

### Frontend — components (`vue-project/src/components/`)

The 29 reusable pieces. The ones worth reading:

| Component | Why it matters |
|---|---|
| `CartDrawer.vue` / `ShopCart.vue` | The slide-out cart; the main consumer of the shop store |
| `Navbar.vue` / `Footer.vue` | Storefront chrome; the navbar hosts the notification bell and cart badge |
| `SearchOverlay.vue` | Full-screen search, driven by the `ui` store |
| `QuickViewModal.vue` / `ProductPreview.vue` | Product preview without leaving the listing |
| `ImageLightbox.vue` / `LazyImage.vue` | Gallery zoom, and deferred image loading via `IntersectionObserver` |
| `ImageUploader.vue` | Admin image upload (the Multer-backed flow) |
| `RolePermissionManager.vue` | The RBAC matrix UI behind `/api/roles` |
| `HeroCarousel.vue` / `ProductCarousel.vue` / `TabbedProductCarousel.vue` / `RecentlyViewed.vue` | The discovery surfaces on the home page |
| `ThemeToggle.vue` / `Toast.vue` / `ToastContainer.vue` | The composable-backed UI primitives |
| `SkeletonLoader.vue` | Loading placeholders, so lists do not jump |

---

### Frontend — views (`vue-project/src/views/`)

43 files, grouped by audience. The important ones:

| Area | Files | Notes |
|---|---|---|
| Storefront root | `Home.vue`, `Product`/`ProductDetail` | `Home` composes the carousels; `ProductDetail` is the one view that manages its own SEO tags, which is why the router skips it |
| Checkout | `checkout/Checkout.vue`, `Payment.vue`, `OrderSucces.vue` | Multi-step flow; `Payment` shows configurable methods including COD with its fee |
| Account | `UserProfile.vue`, `Wishlist.vue`, `UserNotifications.vue`, `Settings.vue` | `Settings.vue` also registers the service worker and the push subscription |
| Auth | `auth/Login.vue`, `auth/Register.vue`, `auth/ForgetPass.vue` | Public; the router redirects authenticated users away from the first two |
| Admin | `dashboard/*` (14 screens) | `Dashboard.vue` (charts + drag-and-drop), `Analytic.vue` (Chart.js), `ManageProducts` (which also manages the discounts that have no screen of their own), `AddProduct`, `ManageStocks`, `ManageUser`, `Orders`, `Reports`, `ActivityLog`, `ManageReviews`, `ManagePaymentMethods`, `ManageCategories`, `Config`, `NotificationsPage` |
| Services & policies | `pages/*` (13 files) | `TrackOrder`, `Returns`, `Shipping`, `FAQ`, `GiftCards`, `Careers`, `Press`, `Blog`, `BlogPost`, `CompareProducts`, `PrivacyPolicy`, `TermsOfService`, `Sitemap` — content pages, little logic || Errors | `NotFound.vue` | Catches `/:pathMatch(.*)*` |

---

### Frontend — utilities and the service worker

**`src/utility/DownloadReceipt.js`** — the only `html2pdf.js` consumer; renders the
order receipt to PDF. **`src/utility/WishlistItem.js`** — wishlist item helpers.

**`public/sw.js` — the push service worker.**
Handles `push` (spreads the payload over defaults, `showNotification` with
vibrate/tag/actions) and `notificationclick` (focus an existing tab on that URL, or
open a new one; defaults to `/admin/dashboard`). Payloads are shaped by
`pushService.js`, and the click target comes from `notification.data.url` — so the two
files must be kept in step.

---

## 17. Interview Q&A

**"Walk me through the architecture."**
A Vue 3 SPA on port 3001 talks only to an Express 5 REST API on port 5001, which is
the only thing that touches PostgreSQL 18. The API is layered
`routes → controllers → services → models`: routes wire URLs to handlers and
middleware, controllers are thin HTTP adapters, services own business rules, and
models own all SQL through a shared `pg` pool. The frontend mirrors the backend's
resources one-to-one in `src/api/`.

**"Why not just put SQL in the controller?"**
Three reasons: the SQL has one home, so a schema change touches one layer; services
become unit-testable without a database; and business rules cannot accidentally
depend on HTTP details like `req.body`. The cost is more files, which this project
accepts because the API has 16 resources.

**"How does login work?"**
`POST /api/auth/login` verifies the password with bcrypt, then issues two httpOnly
cookies: a signed 15-minute JWT in `auth_token` (path `/`) and an opaque, 256-bit
random refresh token in `refresh_token` (path `/api/auth`), stored only as a SHA-256
hash. The client never reads either cookie; page scripts cannot.

**"What happens when the access token expires?"**
Any protected call answers 401. An axios response interceptor calls
`POST /api/auth/refresh` once — shared across concurrent 401s via a module-level
promise — and replays the original request, marked so it is only retried once.

**"Why rotate refresh tokens, and what if one is stolen?"**
Rotation limits a stolen token's value to a single use. Because the revoked row is
*kept* rather than deleted, presenting it again is detectable: the server treats it
as theft and revokes every session for that user. `/api/auth/logout-all` and password
changes do the same deliberately.

**"Why not put the JWT in localStorage?"**
Any XSS can read `localStorage` and exfiltrate the token. httpOnly cookies are
unreadable by page scripts. The trade-off is CSRF exposure — which is why the app
pairs cookies with a double-submit CSRF token rather than relying on cookies alone.

**"How do you prevent CSRF?"**
A random `csrf-token` cookie (deliberately readable) must be echoed in the
`x-csrf-token` header on every unsafe method; the server rejects missing or mismatched
tokens with 403. Cross-site JavaScript can do neither. `sameSite=lax` is a second
layer.

**"How does authorization work?"**
Twice. Route level: `protect` verifies the JWT, `isAdmin`/`isUser` check `role_id`.
Row level: orders, payments, addresses and reviews compare the row's `usersid` to
`req.user.id` and return 403 — which is what stops IDOR. Profile updates ignore any
`role_id` in the request body and read it from the stored row, so nobody can promote
themselves.

**"How do migrations work?"**
`npm run migrate` reads `migrations/`, sorts by filename, and skips anything already
in `schema_migrations`. Each file and its bookkeeping insert run in a single
transaction, so a failure rolls back completely. `--status` lists applied vs pending.
Because migrations are strictly additive and predate the core tables, setup also
applies `schema/000_base_schema.sql` — the `pg_dump` snapshot of the original 18
tables and 5 views — but only into a database that has no `products` table.

**"How do you know the badge is correct in every tab?"**
One Pinia store owns the unread count. It polls once every 60s (plus on load, on tab
focus, and on bell open) and broadcasts every change over a `BroadcastChannel`, with
a `localStorage` fallback for browsers without it. It only publishes on an actual
change, so tabs cannot ping-pong messages.

**"How is it tested?"**
629 tests across three suites: 197 frontend (Vitest + Testing Library + jsdom), 256
backend unit tests targeting services, and 176 integration tests driving real routes
against a real database with Supertest. Startup side effects are guarded by
environment checks (`app.listen` behind `isTestEnv`, the DB ping behind `VITEST`), so
importing the app in a test has no consequences.

**"What would you change if you had more time?"**
See §18 — the honest list. The two headline items are the `role_id` inconsistency and
the raw SQL in `main.js`.

---

## 18. Gotchas, Inconsistencies & Honest Weak Spots

Knowing these is a strength. Each is a real observation about this repository.

1. **`role_id` means different things in different places.** Backend `isAdmin` accepts
   1 **or** 2; the auth and notifications stores treat `<= 2` as admin; the router
   guard requires exactly `1`. A `role_id = 2` account is therefore handed admin
   notification endpoints yet locked out of `/admin/*`. Consolidate on one definition.

2. **Raw SQL lives outside the model layer.** `main.js`'s `/sitemap.xml` handler runs
   `SELECT ... FROM products` directly, and `setup.js` counts rows directly. For a
   script that is defensible; for `main.js` it contradicts the documented rule that
   SQL belongs in models. It is also the only place the "no business logic in
   `main.js`" convention is bent.

3. **The storefront "PWA" story is partial.** Web push and a service worker exist, but
   there is no offline cache, no web app manifest, and no install flow. Calling it
   "PWA-style web push" is accurate; calling it a PWA is not.

4. **Image delivery depends on the bucket staying public.** Product images are now
   uploaded to object storage and read straight from its CDN, which removes the old
   `/cdn` `express.static` bottleneck — but the bucket (or a signed-URL layer in
   front of it) has to remain reachable or every product image breaks at once.

5. **Migration ordering is filename-alphabetical.** There are no numeric prefixes, so
   a migration whose name sorts earlier than one it depends on will run out of order.
   A `001_`, `002_` prefix convention would make the dependency order explicit.

6. **The sitemap and the frontend can disagree about the host.** `sitemap.xml` is
   served by the API but advertises `FRONTEND_URL` URLs, so the two origins must be
   unified in production or the sitemap points at the wrong host.

7. **`usersid` is not `user_id`.** Primary keys are written as one unseparated word
   (`productsid`, `usersid`) while other columns use snake case (`role_id`,
   `password_hash`). It works, but it costs every new contributor a lookup, and prose
   (including the CV entry in `PROJECT_OVERVIEW.md`) that says `user_id` does not
   match the actual column.

8. **Rate limiters are disabled under test.** `rateLimitMiddleware` sets
   `skip: isTestEnv`, so the auth routes never exercise the limiter they are attached
   to — coverage of limiting behaviour comes from `rateLimitMiddleware.test.js`
   instead. Worth stating before a reviewer finds it.

9. **`PROJECT_OVERVIEW.md` lists a `wishlist` Pinia store that does not exist.**
   Wishlist state lives in `shop.js`, with `api/wishlistApi.js` as its HTTP layer.

10. **The schema has two sources of truth.** `notificationModel`, `reviewModel` and
    `newsletterModel` create their own tables at runtime through
    `ensureTable`-style functions instead of relying on `migrations/`. It keeps those
    features self-contained, but it means a read path can trigger DDL, and a table can
    exist without any migration recording it — which undermines the whole point of
    `schema_migrations`.

**If asked "what would you improve first?"** — pick (1) for correctness, because it is
a live authorization bug in a multi-admin setup, then (10) and (2) as maintainability
wins with small, low-risk diffs.

---

<p align="center">
  Part of the AlieeShop project — see <a href="./README.md">README.md</a> for setup and
  <a href="./PROJECT_OVERVIEW.md">PROJECT_OVERVIEW.md</a> for the codebase tour.
</p>
