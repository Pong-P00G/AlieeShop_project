# AlieeShop — Flow Chart

How a request, a session, an order and a stock alert actually travel through the
system. Everything here is traced from the code, not from intent: file references
sit next to each stage so a change can be checked against the diagram.

Companion doc: [ER_DIAGRAM.md](./ER_DIAGRAM.md) for the tables these flows read
and write.

| Flow | Entry point |
|---|---|
| [Request pipeline](#1-request-pipeline) | every call to `/api/*` |
| [Login](#2-login) | `POST /api/auth/login` |
| [Silent session refresh](#3-silent-session-refresh) | `POST /api/auth/refresh` |
| [Logout and revocation](#4-logout-and-revocation) | `/api/auth/logout`, `/logout-all` |
| [Cart → checkout → payment](#5-cart--checkout--payment) | `/checkout` |
| [Order status](#6-order-status) | `PUT /api/orders/:id/status` |
| [Stock and low-stock alerts](#7-stock-and-low-stock-alerts) | `POST /api/dashboard/check-low-stock` |
| [Full journey — one picture](#full-journey--one-picture) | whole app, drawn in the sketch style |

---

## Full journey — one picture

Everything below on a single canvas, in the sketch/whiteboard style of the
reference drawing: white hand-drawn boxes for pages, parallelograms for roles,
diamonds for decisions, stadiums for gates and plain edge labels (`yes`, `no`,
`by default`, `high privilege`).

![AlieeShop full flow chart](./FLOW_CHART.png)

Pre-rendered above as `FLOW_CHART.png`; the Mermaid source that produces it is
below. The hand-drawn look needs Mermaid 11 or newer — older renderers ignore
the `init` directive and draw plain rectangles, which is why the image is
committed alongside the source.

Regenerate the image after editing that first diagram:

```bash
awk '/^```mermaid$/{f=1;next} /^```$/{if(f){exit}} f' FLOW_CHART.md > /tmp/full.mmd
npx @mermaid-js/mermaid-cli -i /tmp/full.mmd -o FLOW_CHART.png -b "#FCFCC8" -w 4545
```

```mermaid
%%{init: {"look":"handDrawn","handDrawnSeed":11,"theme":"base","themeVariables":{"background":"#FCFCC8","primaryColor":"#FFFFFF","primaryBorderColor":"#333333","primaryTextColor":"#1A1A1A","lineColor":"#333333","secondaryColor":"#FFFFFF","tertiaryColor":"#FFFFFF","edgeLabelBackground":"#FCFCC8","actorBkg":"#FFFFFF","actorBorder":"#333333","actorTextColor":"#1A1A1A","signalColor":"#333333","signalTextColor":"#1A1A1A","noteBkgColor":"#FFF7A8","noteBorderColor":"#333333","noteTextColor":"#1A1A1A","labelBackgroundColor":"#FCFCC8","fontFamily":"Segoe Print, Comic Sans MS, cursive","fontSize":"15px"},"flowchart":{"curve":"basis","nodeSpacing":55,"rankSpacing":70,"padding":24}}}%%
flowchart LR
    visitor(["visitor"])
    home["Main page<br/>(home page)"]
    catalog["Browse store<br/>/product · search · tags"]
    detail["Product detail<br/>/product/:id"]
    cart["Cart<br/>/api/cart"]
    guest["Guest browsing<br/>wishlist · compare · FAQ"]
    gate(["Need account<br/>for purchase?"])
    login["Sign in<br/>/login"]
    signup["Sign up<br/>/register"]
    forgot["Forgot password<br/>/forgotPassword"]
    roles{"role_id"}
    customers[/"customers"/]
    admin[/"admin"/]
    sa[/"Super admin"/]
    checkout["Checkout<br/>/checkout"]
    order["Order placed<br/>POST /api/orders"]
    pay{"payment method"}
    card["Card<br/>payment paid"]
    cod["Cash on delivery<br/>COD fee added"]
    markpaid["Mark COD paid<br/>(admin)"]
    success["Order confirmed<br/>/orderSucces"]
    track["Track order<br/>+ notifications"]
    dashboard["Dashboard<br/>/admin/dashboard"]
    manage["Manage products · stock<br/>orders · users · reviews"]
    status["Update order status<br/>pending to delivered"]
    stock["Low-stock check<br/>/api/dashboard/check-low-stock"]
    notify(["Notification<br/>+ web push"])

    visitor --> home
    home --> catalog
    catalog --> detail
    detail --> cart
    cart --> gate
    gate -- yes --> login
    gate -- no --> guest
    guest --> catalog
    login -- "no account" --> signup
    login --> forgot
    forgot --> login
    login --> roles
    signup --> roles
    roles -- "3 customer (default)" --> customers
    roles -- "2 admin" --> admin
    roles -- "1 high privilege" --> sa
    customers --> checkout
    checkout --> order
    order --> pay
    pay -- card --> card
    pay -- COD --> cod
    card --> success
    cod --> markpaid
    markpaid --> success
    success --> track
    sa --> dashboard
    admin -- "admin APIs only" --> manage
    dashboard --> manage
    manage --> status
    manage --> stock
    order --> notify
    status --> notify
    stock --> notify
    notify --> track
    notify --> dashboard
```

Reading it against the code: `router.beforeEach` in
`vue-project/src/router/index.js` is what sends an unauthenticated visitor to
`/login`, an authenticated one away from `/login`, and a non-role-1 user away
from `/admin/*` — the three role branches above come straight from that guard.

---

## 1. Request pipeline

Every request crosses the same middleware stack in `server/src/main.js` before a
route handler sees it. Layers run in this order:

```mermaid
%%{init: {"look":"handDrawn","handDrawnSeed":11,"theme":"base","themeVariables":{"background":"#FCFCC8","primaryColor":"#FFFFFF","primaryBorderColor":"#333333","primaryTextColor":"#1A1A1A","lineColor":"#333333","secondaryColor":"#FFFFFF","tertiaryColor":"#FFFFFF","edgeLabelBackground":"#FCFCC8","actorBkg":"#FFFFFF","actorBorder":"#333333","actorTextColor":"#1A1A1A","signalColor":"#333333","signalTextColor":"#1A1A1A","noteBkgColor":"#FFF7A8","noteBorderColor":"#333333","noteTextColor":"#1A1A1A","labelBackgroundColor":"#FCFCC8","fontFamily":"Segoe Print, Comic Sans MS, cursive","fontSize":"15px"},"flowchart":{"curve":"basis","nodeSpacing":55,"rankSpacing":70,"padding":24}}}%%
flowchart TD
    A["Browser — Vue 3 SPA<br/>axios withCredentials"] --> B["Helmet + gzip"]
    B --> C{"Global rate limit<br/>1000 req / 15 min / IP"}
    C -- exceeded --> C1["429 Too many requests"]
    C -- ok --> D["CORS: only FRONTEND_URL<br/>+ dev localhost origins"]
    D -- rejected --> D1["Error: Not allowed by CORS"]
    D -- ok --> E["express.json / urlencoded<br/>cookieParser"]
    E --> F{"CSRF middleware"}
    F -- "GET / HEAD / OPTIONS" --> F1["set csrf-token cookie<br/>if missing"] --> G
    F -- "POST / PUT / DELETE" --> F2{"cookie == x-csrf-token header?"}
    F2 -- no --> F3["403 CSRF token missing or mismatch"]
    F2 -- yes --> G["Route module<br/>/api/auth, /api/cart, /api/orders …"]
    G --> H{"protect — JWT from<br/>auth_token cookie or Bearer header"}
    H -- missing / invalid --> H1["401 Not authorized"]
    H -- valid --> I{"isAdmin / isUser"}
    I -- wrong role --> I1["403 Access denied"]
    I -- ok --> J["Controller — status codes,<br/>req.user.id + req.user.role_id"]
    J --> K["Service — rules, transactions,<br/>notifications, ownership checks"]
    K --> L["Model — parameterised SQL only"]
    L --> M[("PostgreSQL 18<br/>pool, DB_* from server/.env")]
    M --> J
    J --> N["JSON response { success, data|message }"]
    N --> A
    G -.-> O["404 Route not found"]
    K -.-> P["Global error handler<br/>err.status or 500"]
    P --> N
```

Two details that bite when reading logs:

- `req.user` is `{ id, role_id }` from the JWT payload — no database lookup on
  the hot path, which is why a role change only takes effect on the next login
  or refresh.
- Controllers translate `err.status` (set by services) into HTTP codes. A raw
  PostgreSQL error therefore surfaces as a 500, which is why services catch
  `23505` / `23503` and re-throw 409s (`paymentService.js`).

Rate limits are per IP: **1000 / 15 min** globally (`RATE_LIMIT_MAX`),
**10 failed** login+register attempts (`authLimiter`, successful ones are not
counted) and **60 refreshes** (`refreshLimiter`), all disabled when
`NODE_ENV=test`.

---

## 2. Login

`POST /api/auth/login` takes `{ identifier, password, rememberMe }`, where
`identifier` is either the email or the username.

```mermaid
%%{init: {"look":"handDrawn","handDrawnSeed":11,"theme":"base","themeVariables":{"background":"#FCFCC8","primaryColor":"#FFFFFF","primaryBorderColor":"#333333","primaryTextColor":"#1A1A1A","lineColor":"#333333","secondaryColor":"#FFFFFF","tertiaryColor":"#FFFFFF","edgeLabelBackground":"#FCFCC8","actorBkg":"#FFFFFF","actorBorder":"#333333","actorTextColor":"#1A1A1A","signalColor":"#333333","signalTextColor":"#1A1A1A","noteBkgColor":"#FFF7A8","noteBorderColor":"#333333","noteTextColor":"#1A1A1A","labelBackgroundColor":"#FCFCC8","fontFamily":"Segoe Print, Comic Sans MS, cursive","fontSize":"15px"},"flowchart":{"curve":"basis","nodeSpacing":55,"rankSpacing":70,"padding":24}}}%%
flowchart TD
    A["POST /api/auth/login<br/>{identifier, password, rememberMe}<br/>+ x-csrf-token"] --> B{"authLimiter<br/>10 failed / 15 min"}
    B -- exceeded --> B1["429 try again in 15 min"]
    B -- ok --> C["validateLogin (Joi)"]
    C -- invalid --> C1["400 validation message"]
    C -- valid --> D["userController.loginUser"]
    D --> E["userService.login()"]
    E --> F["SELECT user WHERE<br/>email = $1 OR username = $1"]
    F --> G{"user found?"}
    G -- no --> H["401 Invalid credentials"]
    G -- yes --> I["bcrypt.compare<br/>(password, passwordhash)"]
    I --> J{"hash matches?"}
    J -- no --> H
    J -- yes --> K["tokenService.issueTokens<br/>(role, rememberMe)"]
    K --> L["jwt.sign({ id, role_id })<br/>15 min access token"]
    L --> M["refresh = 32 random bytes<br/>store only sha256(refresh)<br/>expiry 7d or 30d"]
    M --> N["INSERT refresh_tokens"]
    N --> O["deleteExpiredRefreshTokens<br/>(fire and forget)"]
    O --> P["Set-Cookie auth_token (/, 15m)<br/>Set-Cookie refresh_token (/api/auth)<br/>200 { token, user }"]
```

- Public registration always creates role **3 (customer)** and issues the same
  cookie pair, so a new account is logged in immediately.
- Password hashing is bcrypt cost 12 in `userService.js` only. Nothing hashes in
  the database — the legacy triggers were removed by
  `remove_password_hash_triggers.sql`.
- The refresh cookie is scoped to `/api/auth` on purpose: it is never sent with
  ordinary API calls, so a leaked access token does not carry the long-lived
  session with it.

---

## 3. Silent session refresh

The access token lives 15 minutes. When it expires, `vue-project/src/api/api.js`
turns the 401 into one refresh attempt and a single replay of the original
request — the user never sees it.

```mermaid
%%{init: {"look":"handDrawn","handDrawnSeed":11,"theme":"base","themeVariables":{"background":"#FCFCC8","primaryColor":"#FFFFFF","primaryBorderColor":"#333333","primaryTextColor":"#1A1A1A","lineColor":"#333333","secondaryColor":"#FFFFFF","tertiaryColor":"#FFFFFF","edgeLabelBackground":"#FCFCC8","actorBkg":"#FFFFFF","actorBorder":"#333333","actorTextColor":"#1A1A1A","signalColor":"#333333","signalTextColor":"#1A1A1A","noteBkgColor":"#FFF7A8","noteBorderColor":"#333333","noteTextColor":"#1A1A1A","labelBackgroundColor":"#FCFCC8","fontFamily":"Segoe Print, Comic Sans MS, cursive","fontSize":"15px"},"flowchart":{"curve":"basis","nodeSpacing":55,"rankSpacing":70,"padding":24}}}%%
flowchart TD
    A["Any protected request"] --> B{"401?"}
    B -- no --> Z["Response returned"]
    B -- yes --> C{"URL is /auth/login<br/>or /auth/register?"}
    C -- yes --> C1["Reject — bad credentials,<br/>do not refresh"]
    C -- no --> D{"Already retried, or<br/>_skipAuthRefresh?"}
    D -- yes --> D1["Reject"]
    D -- no --> E["refreshAccessToken()<br/>concurrent 401s share one promise"]
    E --> F["POST /api/auth/refresh<br/>refreshLimiter 60 / 15 min"]
    F --> G{"Refresh cookie found?"}
    G -- no --> G1["401 + clear cookies"]
    G -- yes --> H["sha256(token) → lookup refresh_tokens"]
    H --> I{"Row exists?"}
    I -- no --> I1["401 — session unknown"]
    I -- yes --> J{"revokedat set,<br/>expired, or user inactive?"}
    J -- yes --> J1["Reuse detected:<br/>revoke ALL refresh tokens<br/>for that user → 401"]
    J -- no --> K["Revoke presented token,<br/>issue new access + refresh pair"]
    K --> L["Set-Cookie both tokens<br/>200 { token }"]
    L --> M["Replay original request once<br/>_retriedAfterRefresh = true"]
    M --> Z
    I1 --> N["redirect /login"]
    J1 --> N
    G1 --> N
```

The single-use property is the security feature: presenting an already-rotated
token means someone is replaying a stolen cookie, so every session for that user
is revoked (`tokenService.rotateRefreshToken`). That is also why logout keeps the
row and only stamps `revokedat` — it has to stay around to be recognised as a
reuse.

---

## 4. Logout and revocation

| Action | Endpoint | Effect |
|---|---|---|
| Logout | `POST /api/auth/logout` | Revokes the presented refresh token, clears both cookies. The access token stays valid until it expires — it is stateless. |
| Logout everywhere | `POST /api/auth/logout-all` (protected) | Revokes every refresh token for the user, clears cookies. |
| Password change | `PUT /api/users/:id` | `userService.updateUser` hashes the new password, then revokes every refresh token for that user. |
| Profile / role change | — | No revocation: the current access token keeps its old `role_id` until it expires or is refreshed. |

```mermaid
%%{init: {"look":"handDrawn","handDrawnSeed":11,"theme":"base","themeVariables":{"background":"#FCFCC8","primaryColor":"#FFFFFF","primaryBorderColor":"#333333","primaryTextColor":"#1A1A1A","lineColor":"#333333","secondaryColor":"#FFFFFF","tertiaryColor":"#FFFFFF","edgeLabelBackground":"#FCFCC8","actorBkg":"#FFFFFF","actorBorder":"#333333","actorTextColor":"#1A1A1A","signalColor":"#333333","signalTextColor":"#1A1A1A","noteBkgColor":"#FFF7A8","noteBorderColor":"#333333","noteTextColor":"#1A1A1A","labelBackgroundColor":"#FCFCC8","fontFamily":"Segoe Print, Comic Sans MS, cursive","fontSize":"15px"},"flowchart":{"curve":"basis","nodeSpacing":55,"rankSpacing":70,"padding":24}}}%%
flowchart LR
    A["POST /logout"] --> B["revokeRefreshToken(sha256(cookie))"]
    B --> C["clear auth_token + refresh_token"]
    D["POST /logout-all"] --> E["revokeAllUserRefreshTokens(req.user.id)"]
    E --> C
    F["Password change"] --> G["bcrypt.hash(new password)"]
    G --> E
```

---

## 5. Cart → checkout → payment

The SPA keeps a local cart in Pinia and syncs it to the server immediately
before creating the order, so the transaction always starts from server-side
cart rows.

```mermaid
%%{init: {"look":"handDrawn","handDrawnSeed":11,"theme":"base","themeVariables":{"background":"#FCFCC8","primaryColor":"#FFFFFF","primaryBorderColor":"#333333","primaryTextColor":"#1A1A1A","lineColor":"#333333","secondaryColor":"#FFFFFF","tertiaryColor":"#FFFFFF","edgeLabelBackground":"#FCFCC8","actorBkg":"#FFFFFF","actorBorder":"#333333","actorTextColor":"#1A1A1A","signalColor":"#333333","signalTextColor":"#1A1A1A","noteBkgColor":"#FFF7A8","noteBorderColor":"#333333","noteTextColor":"#1A1A1A","labelBackgroundColor":"#FCFCC8","fontFamily":"Segoe Print, Comic Sans MS, cursive","fontSize":"15px"},"flowchart":{"curve":"basis","nodeSpacing":55,"rankSpacing":70,"padding":24}}}%%
flowchart TD
    A["Checkout.vue — address validated"] --> B["POST /api/shipping/rates<br/>(public: no auth; CSRF still enforced)"]
    B --> B1["shippingService: free-shipping threshold<br/>from store_settings"]
    A --> C["GET /api/payments/methods<br/>active methods only"]
    A --> D["syncCartToBackend:<br/>DELETE /api/cart, then POST /api/cart/items<br/>for every local line (parallel)"]
    D --> E["POST /api/orders"]
    E --> F{"Cart empty?"}
    F -- yes --> F1["400 Cart is empty"]
    F -- no --> G["BEGIN"]
    G --> H["INSERT orders (status pending, totalamount 0)"]
    H --> I["For each cart line:<br/>read products.baseprice → INSERT orderitems<br/>(price snapshot; cart price is never trusted)"]
    I --> J["UPDATE orders.totalamount<br/>= SUM(quantity * unitprice)"]
    J --> K["Decrement stock per line:<br/>variant row → product row → drain variant rows"]
    K --> L{"Enough stock?"}
    L -- no --> L1["409 Insufficient stock<br/>ROLLBACK everything"]
    L -- yes --> M["DELETE cartitems for this cart"]
    M --> N["COMMIT"]
    N --> O["Return hydrated order<br/>+ notifyNewOrder (fire and forget)"]
    O --> P["POST /api/orders/:id/pay<br/>{ method_id, amount }"]
    P --> Q{"Method exists and active?"}
    Q -- no --> Q1["404 / 400"]
    Q -- yes --> R{"amount == order total<br/>(+ COD fee for COD) ?"}
    R -- no --> R1["400 amount does not match expected total"]
    R -- yes --> S["BEGIN"]
    S --> T{"Cash on Delivery?"}
    T -- no --> T1["INSERT payments status paid<br/>order pending → confirmed"]
    T -- yes --> T2["INSERT payments status pending<br/>order stays pending"]
    T1 --> U["COMMIT → 200 payment"]
    T2 --> U
```

Notes on the transaction boundaries:

- `orderService.createOrderFromCart` owns one transaction: order, items, total,
  stock decrement and cart clear all commit or roll back together. Stock
  insufficiency is a 409, not a partial order.
- `paymentService.recordPayment` owns a second transaction: payment row plus the
  `pending → confirmed` promotion. A failed payment therefore leaves a valid
  pending order rather than losing it.
- Cash on Delivery is recognised by `methodName === 'Cash on Delivery'`, not by
  an id or flag. Its fee (`paymentmethod.fee`, $2.50) is added to the expected
  amount and the payment is recorded as `pending` until an admin confirms
  delivery with `PUT /api/orders/:id/mark-paid`.

**Known gap in this path.** The SPA sends `orderTotal` (subtotal + shipping +
tax − promo + COD fee), while the API compares the amount against
`orders.totalamount`, which only ever holds the sum of the line items — shipping
and tax are never written to the order. With a non-zero shipping or tax rate,
`amount does not match expected total` is the result. The diagrams above show the
code as written; treat aligning those two totals as open work, not as a
documented behaviour.

---

## 6. Order status

`orders.status` is constrained to five values, and `PUT /api/orders/:id/status`
(admin only) validates the value against that list — it does **not** validate the
transition. Any admin can move any order to any status, and each accepted change
writes a customer notification.

```mermaid
%%{init: {"look":"handDrawn","handDrawnSeed":11,"theme":"base","themeVariables":{"background":"#FCFCC8","primaryColor":"#FFFFFF","primaryBorderColor":"#333333","primaryTextColor":"#1A1A1A","lineColor":"#333333","secondaryColor":"#FFFFFF","tertiaryColor":"#FFFFFF","edgeLabelBackground":"#FCFCC8","actorBkg":"#FFFFFF","actorBorder":"#333333","actorTextColor":"#1A1A1A","signalColor":"#333333","signalTextColor":"#1A1A1A","noteBkgColor":"#FFF7A8","noteBorderColor":"#333333","noteTextColor":"#1A1A1A","labelBackgroundColor":"#FCFCC8","fontFamily":"Segoe Print, Comic Sans MS, cursive","fontSize":"15px"},"flowchart":{"curve":"basis","nodeSpacing":55,"rankSpacing":70,"padding":24}}}%%
stateDiagram-v2
    [*] --> pending: POST /api/orders
    pending --> confirmed: payment recorded (non-COD)<br/>or COD mark-paid<br/>or admin PUT status
    confirmed --> shipped: admin PUT status
    shipped --> delivered: admin PUT status
    pending --> cancelled: admin PUT status
    confirmed --> cancelled: admin PUT status
    shipped --> cancelled: admin PUT status
    delivered --> [*]
    cancelled --> [*]

    note right of pending
        COD orders stay here until
        an admin marks the payment paid
    end note

    note right of confirmed
        payment row exists and is either
        paid (card) or pending (COD)
    end note
```

`payments.status` follows the same pattern — `pending | paid | failed |
refunded` — but only `paid` (online) and `pending → paid` (COD) are ever written
by the current code; nothing sets `failed` or `refunded` yet.

---

## 7. Stock and low-stock alerts

Stock is written in two places: the order transaction (decrement) and the admin
inventory screens (set quantity / adjust, which also writes a `stocklog` row).

```mermaid
%%{init: {"look":"handDrawn","handDrawnSeed":11,"theme":"base","themeVariables":{"background":"#FCFCC8","primaryColor":"#FFFFFF","primaryBorderColor":"#333333","primaryTextColor":"#1A1A1A","lineColor":"#333333","secondaryColor":"#FFFFFF","tertiaryColor":"#FFFFFF","edgeLabelBackground":"#FCFCC8","actorBkg":"#FFFFFF","actorBorder":"#333333","actorTextColor":"#1A1A1A","signalColor":"#333333","signalTextColor":"#1A1A1A","noteBkgColor":"#FFF7A8","noteBorderColor":"#333333","noteTextColor":"#1A1A1A","labelBackgroundColor":"#FCFCC8","fontFamily":"Segoe Print, Comic Sans MS, cursive","fontSize":"15px"},"flowchart":{"curve":"basis","nodeSpacing":55,"rankSpacing":70,"padding":24}}}%%
flowchart TD
    A["Order committed"] --> A1["stock.quantity -= qty<br/>updatedat = NOW()"]
    B["Admin edits stock"] --> B1["INSERT stocklog<br/>IN | OUT | ADJUST | RETURN | DAMAGED"]
    A1 --> C["POST /api/dashboard/check-low-stock<br/>(admin, manual trigger)"]
    C --> D["SELECT … FROM view_stock_low LIMIT 50<br/>active products at or below minstock"]
    D --> E{"Unread stock notification for this<br/>product/SKU in the last 24h?"}
    E -- yes --> E1["Skip — avoids duplicate alerts"]
    E -- no --> F["createNotification({ type: 'stock', … })"]
    F --> G["INSERT notifications<br/>userid NULL = admin broadcast"]
    G --> H["Build push payload<br/>title from type, body = message"]
    H --> I{"userId set?"}
    I -- yes --> I1["sendPushToUser — that user's devices"]
    I -- no --> I2["sendPushToAllSubscribers"]
    I1 --> J["Push failure: log only,<br/>notification row already saved"]
    I2 --> J
    J --> K["Dashboard badge / notifications page"]
```

The same `createNotification` helper is the single fan-out point for every
automatic alert, which is what makes the delivery rules consistent:

| Trigger | Type | Audience |
|---|---|---|
| New order (`notifyNewOrder`) | `order` | Admin broadcast **and** the customer |
| Order status change (`notifyOrderStatusChange`) | `order` | Admin broadcast **and** the customer |
| New registration (`notifyNewUser`) | `user` | Admin broadcast |
| New product (`notifyNewProduct`) | `product` | Admin broadcast |
| Low stock (`notifyLowStock`, `checkAndNotifyLowStock`) | `stock` | Admin broadcast |
| Review approved/rejected (`notifyReviewModerated`) | `review` | The review's author |

Reading side: admins poll `GET /api/dashboard/notifications` (unread first, with
a type filter) and mark rows with `PUT /api/dashboard/notifications/:id/read`;
customers use `GET /api/notifications`, `/recent`, `/unread-count` and
`PUT /api/notifications/:id/read`. Web push subscriptions live behind
`POST /api/dashboard/push-subscribe` and only work when the VAPID keys are
configured — `GET /api/dashboard/vapid-public-key` returns `null` otherwise, on
purpose, so the browser cannot subscribe to a key that will never deliver.

Two gaps in this area, both observable in the logs rather than in the UI:

- The low-stock check is **manual** — it runs only when an admin posts to
  `/api/dashboard/check-low-stock`. There is no scheduler or interval in the
  server, so nothing alerts while nobody presses the button.
- `notifyReviewModerated` inserts `type: 'review'`, but the `notifications`
  CHECK constraint allows only `order | user | stock | system | product`. The
  insert fails, `reviewService.recordModeration` catches it and logs
  `Failed to notify review author` — so the audit row is written and the
  customer notification is not.
