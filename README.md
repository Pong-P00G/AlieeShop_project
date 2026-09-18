# AlieeShop - Full-Stack E-Commerce Platform

A modern, full-featured e-commerce platform built with **Vue 3**, **Express**, and **PostgreSQL**. Features a sleek black-and-white design with orange accents, comprehensive admin dashboard, real-time stock management, and Docker-based deployment.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Database Migrations](#database-migrations)
- [API Overview](#api-overview)
- [Testing](#testing)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

```
+-----------------------+       +-----------------------+       +-----------------------+
|   Frontend (Vue 3)    |       |   Backend (Express)   |       |     PostgreSQL 18     |
|    Port 3001 (dev)    | ----> |      Port 5001        | ----> |       Port 5432       |
|   Port 80 (Docker)    |       |  Helmet + Compression |       |                       |
+-----------------------+       +-----------------------+       +-----------------------+
         |                             |
         | /api/*, /cdn/*              | /health
         v                             v
    index.html +                  Health check
    static assets                 endpoint
```

### Architecture Highlights

- **Frontend**: Vue 3 SPA with Pinia state management, Vue Router, Tailwind CSS v4
- **Backend**: RESTful Express API with JWT authentication, role-based access control
- **Database**: PostgreSQL with connection pooling
- **Deployment**: Docker Compose (3 services) - PostgreSQL + API Server + Nginx Frontend
- **Security**: Helmet.js HTTP headers, rate limiting, CSRF protection

---

## Tech Stack

### Frontend (vue-project/)
| Technology | Purpose |
|------------|--------|
| **Vue 3** (Composition API) | UI framework |
| **Vite 7** | Build tool and dev server |
| **Pinia** | State management |
| **Vue Router** | Client-side routing |
| **Tailwind CSS v4** | Utility-first styling |
| **Axios** | HTTP client |
| **Unhead** | SEO meta/OG tag management |
| **Lucide Icons** | Icon library |
| **Chart.js + vue-chartjs** | Dashboard analytics |
| **html2pdf.js** | PDF receipt generation |

### Backend (server/)
| Technology | Purpose |
|------------|--------|
| **Express 5** | HTTP server framework |
| **PostgreSQL (pg)** | Database driver with connection pool |
| **JWT (jsonwebtoken)** | Authentication tokens |
| **bcrypt** | Password hashing |
| **Joi** | Request validation |
| **Multer** | File upload handling |
| **Helmet** | Security HTTP headers |
| **Compression** | Gzip response compression |
| **express-rate-limit** | API rate limiting |

### Infrastructure
| Technology | Purpose |
|------------|--------|
| **Docker Compose** | Multi-container orchestration |
| **Nginx** | Reverse proxy + static file serving |
| **Vitest** | Unit and integration testing |

---

## Project Structure

```
aliee-shop/
├── cdn/                          # Static assets (product images)
│   └── images/products/
├── server/                       # Express API backend
│   ├── migrations/               # SQL migration files
│   ├── src/
│   │   ├── controller/           # Route handlers
│   │   ├── database/             # DB connection pool
│   │   ├── middleware/           # Auth, validation, CSRF
│   │   ├── model/                # Data models
│   │   ├── routes/               # Express route definitions
│   │   ├── services/             # Business logic layer
│   │   └── main.js               # Server entry point
│   ├── tests/                    # Unit and integration tests
│   ├── seed_products.sql         # Sample product data
│   ├── vitest.config.js          # Unit test config
│   └── vitest.integration.config.js
├── vue-project/                  # Vue 3 frontend
│   ├── public/
│   │   └── sw.js                 # Service worker
│   ├── src/
│   │   ├── api/                  # Axios API client modules
│   │   ├── assets/               # Global CSS, icons
│   │   ├── components/           # Reusable UI components
│   │   ├── composables/          # Vue composables
│   │   ├── Layout/               # Layout components
│   │   ├── router/               # Route definitions and guards
│   │   ├── stores/               # Pinia stores
│   │   ├── views/                # Page components
│   │   │   ├── auth/             # Login, Register, ForgotPassword
│   │   │   ├── checkout/         # Checkout flow
│   │   │   ├── dashboard/        # Admin dashboard pages
│   │   │   └── pages/            # Static pages (About, FAQ, etc.)
│   │   └── main.js               # App entry point
│   ├── test/                     # Frontend tests
│   ├── nginx.conf                # Nginx config for Docker
│   └── vite.config.js            # Vite build configuration
├── docker-compose.yml            # Full-stack Docker deployment
├── Dockerfile.server             # Server container image
├── Dockerfile.frontend           # Frontend container image
└── README.md                     # This file
```

---

## Prerequisites

- **Node.js** >= 22 (local development)
- **npm** >= 10
- **PostgreSQL** >= 18 (local dev, or use Docker)
- **Docker Desktop** >= 24 (for containerized deployment)
- **Git**

---

## Quick Start (Development)

### 1. Clone and Install Dependencies

```bash
# Install server dependencies
cd server
cp .env.example .env    # Edit .env with your local DB credentials
npm install

# Install frontend dependencies
cd ../vue-project
cp .env.example .env
npm install
```

### 2. Set Up the Database

```bash
# Create the database
createdb aliee_shop

# Run migrations
psql -d aliee_shop -f server/migrations/*.sql

# (Optional) Seed with sample products
psql -d aliee_shop -f server/seed_products.sql
```

### 3. Configure Environment Variables

**server/.env**:
```env
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_DATABASE=aliee_shop
DB_SSL=false
JWT_SECRET=your_jwt_secret_change_in_production
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
REFRESH_TOKEN_REMEMBER_EXPIRES_IN=30d
```

**vue-project/.env**:
```env
VITE_PORT=3001
VITE_API_BASE_URL=http://localhost:5001
```

### 4. Start Development Servers

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd vue-project
npm run dev
```

The app will be available at **http://localhost:3001**.

---

## Environment Variables

### Server (server/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 5001 | API server port |
| NODE_ENV | No | development | Environment mode |
| FRONTEND_URL | No | http://localhost:3001 | Allowed CORS origin |
| DB_HOST | No | localhost | PostgreSQL host |
| DB_PORT | No | 5432 | PostgreSQL port |
| DB_USER | No | postgres | Database user |
| DB_PASSWORD | Yes | - | Database password |
| DB_DATABASE | No | aliee_shop | Database name |
| DB_SSL | No | false | Enable SSL connection |
| JWT_SECRET | Yes | - | JWT signing secret (>= 32 chars) |
| ACCESS_TOKEN_EXPIRES_IN | No | 15m | Access token lifetime (httpOnly `auth_token` cookie) |
| REFRESH_TOKEN_EXPIRES_IN | No | 7d | Refresh session lifetime (`refresh_token` cookie) |
| REFRESH_TOKEN_REMEMBER_EXPIRES_IN | No | 30d | Refresh session lifetime when "Remember me" is checked |
| VAPID_PUBLIC_KEY | No | - | Web push public key — **all three are required for push to work** |
| VAPID_PRIVATE_KEY | No | - | Web push private key |
| VAPID_EMAIL | No | - | Web push contact email (auto-prefixed with `mailto:`) |

> **Generate a secure JWT secret:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Frontend (vue-project/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| VITE_PORT | No | 3001 | Vite dev server port |
| VITE_API_BASE_URL | No | /api | Backend API base URL |

---

## Docker Deployment

### Architecture (Docker Compose)

Three Docker containers work together:
- **postgres**: PostgreSQL 18 database
- **server**: Node.js Express API (health check at /health)
- **frontend**: Nginx serving Vue build + proxying API requests

### Deploy with Docker Compose

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd aliee-shop

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your production values (DB_PASSWORD, JWT_SECRET, etc.)

# 3. Build and start all services
docker compose up --build -d

# 4. Verify all services are healthy
docker compose ps

# 5. Run database migrations
docker compose exec server sh -c "psql \$DB_DATABASE < /app/migrations/*.sql"

# 6. View logs
docker compose logs -f

# 7. Stop all services
docker compose down
```

The application will be available at **http://localhost**.

### Service Details

| Service | Container Name | Port | Health Check |
|---------|---------------|------|-------------|
| postgres | aliee-postgres | 5432 | pg_isready |
| server | aliee-server | 5001 | curl /health |
| frontend | aliee-frontend | 80 | wget / |

### Useful Docker Commands

```bash
# View logs for a specific service
docker compose logs -f server

# Execute commands inside a container
docker compose exec server node src/main.js

# Rebuild a single service
docker compose build server
docker compose up -d server

# Clean up volumes (WARNING: deletes all data)
docker compose down -v
```

### Nginx Features

The frontend Nginx container (vue-project/nginx.conf) provides:
- **Security headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- **Gzip compression**: For JS, CSS, JSON, images, fonts
- **Static asset caching**: 1-year cache for hashed assets, no-cache for service worker
- **API proxy**: /api/* routes forwarded to the backend server
- **CDN proxy**: /cdn/* routes forwarded to the backend
- **SPA fallback**: All non-file routes serve index.html

---

## Database Migrations

Migration files are located in `server/migrations/`. Run them in order:

```bash
cd server
npm run migrate          # applies pending migrations, records each in schema_migrations
npm run migrate -- --status   # list applied/pending files without changing anything
```

### Migration List

| File | Purpose |
|------|---------|
| add_cash_on_delivery.sql | Cash on delivery payment method |
| add_cod_fee_column.sql | COD fee column |
| add_discounts_createdat.sql | `discounts.createdat` (used by the admin discounts listing) |
| add_low_stock_view.sql | Low stock monitoring view |
| add_notifications.sql | Dashboard notifications and audit log |
| add_product_tags.sql | Product tags |
| remove_password_hash_triggers.sql | Drops legacy DB triggers that double-hashed passwords (app-layer bcrypt is the single source of hashing); keeps `updatedat` auto-update via `trg_touch_updated_at_user` |
| add_refresh_tokens.sql | Revocable/rotating refresh tokens |
| add_reviews_table.sql | Product reviews |
| add_role_permissions.sql | Roles, permissions, and role assignments |
| add_store_settings.sql | Store configuration table |

> Migrations are applied and tracked by the runner above. Run `npm run migrate` after pulling changes — it skips files already recorded in `schema_migrations` and prints an error naming the file if one fails.
| add_variant_price.sql | Product variant pricing |
| add_wishlist_table.sql | Wishlist feature |

---

## API Overview

| Endpoint | Purpose |
|----------|---------|
| /api/auth | Login, register, refresh, logout, logout-all |
| /api/users | User profile (self) and user administration (admin) |
| /api/products | Product CRUD, search, filtering |
| /api/cart | Shopping cart operations |
| /api/orders | Order management |
| /api/payments | Payment processing |
| /api/reviews | Product reviews |
| /api/addresses | Shipping addresses |
| /api/shipping | Shipping methods and rates |
| /api/wishlist | Wishlist management |
| /api/newsletter | Newsletter subscription |
| /api/roles | Role and permission management |
| /api/dashboard | Admin dashboard data |
| /api/settings | Store configuration |
| /api/notifications | User notifications |
| /api/images | Image upload and management |
| /cdn | Static file serving |
| /health | Health check endpoint |

---

## Testing

### Frontend Tests

```bash
cd vue-project

# Run all tests
npm test

# Watch mode
npx vitest
```

### Backend Tests

```bash
cd server

# Unit tests only
npm test

# Integration tests (requires a running database — the script loads server/.env)
npm run test:integration
```

### Test Coverage

| Layer | Tests | Status |
|-------|-------|--------|
| Frontend | 197 tests | All passing |
| Backend (Unit) | 256 tests | All passing |
| Backend (Integration) | 176 tests | All passing (requires a running database) |

---

## Authentication & Session Security

The app never keeps a long-lived credential in the browser. Two httpOnly cookies are used:

| Cookie | Lifetime | Scope | Purpose |
|--------|----------|-------|---------|
| `auth_token` | 15m (`ACCESS_TOKEN_EXPIRES_IN`) | `/` | Short-lived JWT access token, verified on every protected request |
| `refresh_token` | 7d, or 30d with "Remember me" | `/api/auth` | Opaque random token used only to mint new access tokens |

How a session is kept alive:

1. `POST /api/auth/login` (or `/register`) returns both cookies. Only the access token is also returned in the body, for non-browser clients.
2. When a protected request answers `401` because the access token expired, the frontend calls `POST /api/auth/refresh` and replays the original request once (`vue-project/src/api/api.js`).
3. Refresh tokens are **single use**: each refresh revokes the presented row and issues a new one. Only the SHA-256 hash is stored (`refresh_tokens` table), never the raw token.
4. Reusing an already-revoked refresh token is treated as theft — every active session for that user is revoked.
5. `POST /api/auth/logout` revokes the stored refresh token and clears both cookies.
6. `POST /api/auth/logout-all` (authenticated) revokes **every** refresh token for the user — the "sign out everywhere" option, useful after a suspected compromise. Changing a password does the same automatically.

> Access tokens expire in 15 minutes and cannot be revoked individually, so keep
them short and let the refresh token carry the session length.

### Request authorization

`protect` (`server/src/middleware/authMiddleWare.js`) runs on every private
route: it verifies the JWT signature **and** expiry, attaches `{ id, role_id }`
to `req.user`, and answers `401` when the token is missing or invalid — which is
what triggers the client's silent refresh described above.

On top of that, every route enforces who may touch a given row:

| Rule | Where |
|------|-------|
| Admin-only (`isAdmin`) | All of `/api/users` except `/profile`, `/api/roles`, `/api/dashboard`, image upload, product/category/variant/stock/discount writes, `/api/payments/methods/*` |
| Self only (ignores ids in the body/URL) | `PUT /api/users/profile` — `role_id` is always taken from the stored row, never the request, so a user cannot promote themselves |
| Owner or admin | Orders, payments, addresses, reviews (`GET /api/orders/:id`, `POST /api/orders/:id/pay`, `GET /api/orders/:id/payments`, review edit/delete) — each checks the row's `usersid` against `req.user.id` and returns `403` otherwise |
| Implicitly scoped by `req.user.id` | Cart, wishlist and notifications query by owner id; cart item mutations additionally verify the item belongs to the caller's cart |

`password_hash` is never returned by any user endpoint.

### Rate limiting

| Scope | Limit |
|-------|-------|
| Global (all routes, per IP) | 200 requests / 15 min |
| `POST /api/auth/login`, `/register` | 10 **failed** attempts / 15 min per IP — successful logins are not counted, so a shared/NAT IP is not locked out by someone else |
| `POST /api/auth/refresh` | 60 / 15 min per IP |

In production the server sets `trust proxy` to one hop so `req.ip` reflects the
real client behind the nginx container rather than the proxy itself.

### Secrets and CORS

- `server/.env` is gitignored; only `server/.env.example` is committed. `JWT_SECRET`, `DB_PASSWORD`, `VAPID_PRIVATE_KEY` and friends are read exclusively by the server.
- The Vue bundle only reads `VITE_API_BASE_URL` / `VITE_PORT` — nothing else from the environment is exposed to the client (`import.meta.env` is inlined at build time, so never prefix a secret with `VITE_`).
- CORS allows `FRONTEND_URL` plus, **in development only**, the localhost dev origins. No wildcard origin, and `credentials: true`.
- Auth cookies are `httpOnly` + `sameSite=lax`, and `secure` whenever `NODE_ENV=production`.

---

## Notifications & Web Push

In-app notifications live in the `notifications` table: rows with a `userid` are
personal, rows without one are admin broadcasts. Every creation path goes
through one helper in `dashboardService` that stores the row and then dispatches
a push.

| Surface | Endpoint | Who |
|---------|----------|-----|
| Bell dropdown | `GET /api/notifications/recent` / `GET /api/dashboard/notifications` | customer / admin |
| Bell mark-as-read | `PUT /api/notifications/:id/read` / `PUT /api/dashboard/notifications/:id/read` | customer / admin |
| Full page | `GET /api/notifications` (`/admin/notifications` for admins) | both |

Both ends of the bell flow use the **same** role branch — the dashboard
mark-as-read route is admin-only and answers `403` for customers, so a customer
must mark read through `/api/notifications/:id/read`.

### Unread badge

One Pinia store (`vue-project/src/stores/notifications.js`) owns the unread
count, so the public navbar bell, the dashboard bell and both notification pages
can never disagree:

- **One poll, not four.** The store polls every 60 seconds (and immediately after a page load, on tab focus, and whenever a bell is opened) instead of each component keeping its own timer.
- **Cross-tab sync** over a `BroadcastChannel` (`aliee-notifications`). Tabs without it fall back to a `localStorage` write, whose `storage` event is delivered only to other tabs — the same semantics.
- **Instant updates on read.** Marking one notification (or all of them) read from any surface — bell or page — updates the badge in that tab and broadcasts the new count to the others, so no tab is left showing a stale number.
- The count is clamped at zero, never re-broadcast when unchanged (no message ping-pong), and cleared on logout.

### Enabling push notifications

Push is optional and stays disabled unless all three VAPID variables are set:

```bash
npx web-push generate-vapid-keys
# then set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_EMAIL in server/.env
```

- Every notification created via `dashboardService` is also delivered as a web push: admin broadcasts go to **all** subscribers, personal notifications go to that user's devices.
- The payload is shaped for `vue-project/public/sw.js`, which reads the click target from `notification.data.url`.
- Subscriptions the push service reports as gone (`404`/`410`) are deleted automatically; transient failures are logged and retried by the next notification.
- Delivery is best-effort and fire-and-forget: the notification row is always written first, so a push failure never blocks or loses the notification.
- With no VAPID keys, `GET /api/dashboard/vapid-public-key` returns `503` and the settings page reports push as unavailable. There is deliberately **no placeholder key** — subscribing with one would look successful and then silently never deliver.

> Subscribing requires an admin session today (`/api/dashboard/push-subscribe` is
> admin-only and the toggle lives in the dashboard settings), so personal pushes
> for customers have no subscriber to reach until that is opened up.

---

## Production Checklist

Before deploying to production, verify each item:

- [ ] **Generate a strong JWT secret**
- [ ] **Set a strong database password** (>= 16 chars)
- [ ] **Enable DB_SSL** in production (DB_SSL=true)
- [ ] **Set NODE_ENV=production** to enable all security middleware
- [ ] **Configure FRONTEND_URL** to your actual domain
- [ ] **Review CORS origins** - localhost entries are already dropped when NODE_ENV=production
- [ ] **Set up regular database backups**
- [ ] **Set up SSL certificate** for your domain
- [ ] **Review rate limits** - adjust based on traffic expectations
- [ ] **Run all migrations** before starting the application (`cd server && npm run migrate`, including `add_refresh_tokens.sql`)
- [ ] **Keep the access token short-lived** (default 15m) and review refresh token lifetimes
- [ ] **Confirm no secret uses a `VITE_` prefix** - those values are embedded in the public bundle
- [ ] **Verify health checks** pass for all Docker services

---

## Troubleshooting

### Database connection refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Ensure PostgreSQL is running: `pg_isready`
- Check credentials in server/.env

### CORS errors in browser
```
Access to XMLHttpRequest has been blocked by CORS policy
```
- Verify FRONTEND_URL in server/.env matches your frontend origin
- For local dev, ensure both servers are on the allowed origins list

### Docker container exits immediately
```bash
docker compose logs server
```
- Check for missing environment variables (DB_PASSWORD and JWT_SECRET)
- Verify database health check passes before server starts

### Static assets not loading (Docker)
- Verify CDN images exist in cdn/images/products/
- Check nginx proxy pass configuration for /cdn/ routes

### Authentication not persisting after refresh
- Ensure cookies are sent with withCredentials: true
- Verify sameSite and secure cookie settings match your environment
- Logged out after ~15 minutes? Check that `POST /api/auth/refresh` succeeds and returns both cookies; the refresh cookie is scoped to `/api/auth`, so the request must go to that path
- Refresh always fails? Confirm the `refresh_tokens` migration has been run (`npm run migrate -- --status` shows what's missing)

---

## License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built with Vue 3, Express and PostgreSQL
</p>
