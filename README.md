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
JWT_EXPIRES_IN=7d
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
| JWT_EXPIRES_IN | No | 7d | Token expiration duration |
| VAPID_PUBLIC_KEY | No | - | Web push public key |
| VAPID_PRIVATE_KEY | No | - | Web push private key |
| VAPID_EMAIL | No | - | Web push contact email |

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
- **postgres**: PostgreSQL 16 database
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
# Run all migrations
for f in server/migrations/*.sql; do
  psql -d aliee_shop -f "$f"
done
```

### Migration List

| File | Purpose |
|------|---------|
| add_cash_on_delivery.sql | Cash on delivery payment method |
| add_cod_fee_column.sql | COD fee column |
| add_low_stock_view.sql | Low stock monitoring view |
| add_notifications.sql | Dashboard notifications and audit log |
| add_product_tags.sql | Product tags |
| add_reviews_table.sql | Product reviews |
| add_role_permissions.sql | Roles, permissions, and role assignments |
| add_store_settings.sql | Store configuration table |
| add_variant_price.sql | Product variant pricing |
| add_wishlist_table.sql | Wishlist feature |

---

## API Overview

| Endpoint | Purpose |
|----------|---------|
| /api/auth | Login, register, logout |
| /api/users | User profile management |
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

# Integration tests (requires database)
npm run test:integration
```

### Test Coverage

| Layer | Tests | Status |
|-------|-------|--------|
| Frontend | 163 tests | All passing |
| Backend (Unit) | 184 tests | 182 passing (2 pre-existing) |
| Backend (Integration) | - | Requires running database |

---

## Production Checklist

Before deploying to production, verify each item:

- [ ] **Generate a strong JWT secret**
- [ ] **Set a strong database password** (>= 16 chars)
- [ ] **Enable DB_SSL** in production (DB_SSL=true)
- [ ] **Set NODE_ENV=production** to enable all security middleware
- [ ] **Configure FRONTEND_URL** to your actual domain
- [ ] **Review CORS origins** - remove localhost entries for production
- [ ] **Set up regular database backups**
- [ ] **Set up SSL certificate** for your domain
- [ ] **Review rate limits** - adjust based on traffic expectations
- [ ] **Run all migrations** before starting the application
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

---

## License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built with Vue 3, Express and PostgreSQL
</p>
