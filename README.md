# E-Commerce API — NestJS

A REST backend for an online shop: authentication, product catalogue, shopping cart and an order lifecycle with stock reservation, built with **NestJS**, **PostgreSQL** and **RabbitMQ**.

The focus of this project is the backend concerns that matter in real commerce systems: data consistency under concurrent orders, a clear order state machine, token-based auth with rotation, and event-driven integration.

🖥️ **Frontend:** a React storefront and admin panel built on this API lives in [ECommerce-React.js-UI-Project](https://github.com/gokturkturan/ECommerce-React.js-UI-Project).

![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?logo=jest&logoColor=white)

---

## Features

- **Authentication** — register / login with bcrypt-hashed passwords, short-lived JWT access tokens and long-lived refresh tokens with **rotation** and **logout (revocation)**
- **Authorization** — role-based access (`customer`, `admin`) via a custom `@Roles()` decorator and `RolesGuard`
- **Catalogue** — categories and products (CRUD; write operations admin-only) with server-side **search, filtering and sorting** (by name or category, category, price range, in-stock only); validated, unique category slugs
- **Cart** — one cart per user; add, update quantity, remove items or clear the whole cart; ownership checks on every item; **quantities limited to the available stock**; every response carries a **price summary** (subtotal, shipping, total)
- **Server-side pricing** — shipping fee and free-shipping threshold are configured once and used for both the cart summary and the stored order, so the amount shown at checkout is the amount charged
- **Orders** — create an order from the cart with a validated **shipping address**, pay, cancel, ship, with an explicit status state machine; orders store subtotal, shipping fee and total; admins can list all orders
- **Safe deletes** — a category with products can't be deleted (`409`); deleting a product removes it from carts but keeps order history intact
- **Oversell-safe stock reservation** — stock is decremented atomically inside a database transaction (see [Design notes](#design-notes))
- **Event-driven** — every order lifecycle step (`order_created`, `order_paid`, `order_shipped`, `order_cancelled`) is published to RabbitMQ; a consumer stores a **notification** for the customer for each one
- **Cross-cutting concerns** — global validation (`whitelist` + `transform`), global exception filter with a consistent error shape, request logging interceptor with response times, sensitive fields hidden from responses via `class-transformer`
- **Frontend-ready** — CORS configured for the React UI via `CORS_ORIGIN`
- **Tests** — 89 unit tests across services and controllers (Jest)

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | NestJS 12, TypeScript |
| Database | PostgreSQL 16, TypeORM |
| Messaging | RabbitMQ (`@nestjs/microservices`) |
| Auth | Passport JWT, bcrypt |
| Validation | class-validator, class-transformer |
| Testing | Jest, Supertest |
| Tooling | Docker Compose, Oxlint, Prettier |

## Architecture

```
                  ┌──────────────────────────── NestJS application ────────────────────────────┐
                  │                                                                            │
 HTTP client ───▶ │  ValidationPipe → JwtAuthGuard / RolesGuard → Controller → Service         │
                  │        ▲                                                   │               │
                  │        └── LoggingInterceptor · GlobalExceptionFilter      │ TypeORM       │
                  │                                                            ▼               │
                  │  Modules: auth · users · categories · products · cart · orders ·          │
                  │           notifications                                                    │
                  │                                     │                                      │
                  └─────────────────────────────────────┼──────────────────────────────────────┘
                                                        │                        │
                                   emit order_created / paid /                   ▼
                                       shipped / cancelled
                                                        ▼                 ┌──────────────┐
                                             ┌────────────────────┐       │  PostgreSQL  │
                                             │ RabbitMQ           │       └──────────────┘
                                             │ order_events_queue │
                                             └─────────┬──────────┘
                                                       ▼
                                             OrderEventsController
                                             (@EventPattern consumer)
                                                       │
                                                       ▼
                                             NotificationsService
                                             → notifications table
```

Each domain lives in its own Nest module (`src/<module>`) with its controller, service, DTOs, entities and specs. Shared concerns live in `src/common`.

### Order state machine

```
            pay                ship (admin)
 PENDING ─────────▶ PAID ─────────────────▶ SHIPPED
    │
    │ cancel  (stock is returned)
    ▼
 CANCELLED
```

Any transition not shown above is rejected with `400 Bad Request`. Each successful transition publishes the matching event (`order_created`, `order_paid`, `order_shipped`, `order_cancelled`).

## Design notes

**Preventing overselling.** When an order is created, every cart line decrements stock with a single conditional statement inside one transaction:

```sql
UPDATE products SET stock = stock - :qty WHERE id = :id AND stock >= :qty
```

If any line affects zero rows, the whole transaction rolls back and the request fails with `Insufficient stock`. The check and the decrement are one atomic operation, so two concurrent checkouts cannot both take the last item, and no explicit row locks or read-then-write logic are needed. Order lines also store a snapshot of `productName` and `unitPrice`, and the shipping address is stored with the order as JSONB, so later product or profile changes do not rewrite order history.

**Refresh-token rotation.** Refresh tokens are stored server-side as SHA-256 hashes, never in plain text. Every `/auth/refresh` call deletes the presented token and issues a new pair, so a refresh token can be used only once. `/auth/logout` revokes the token. bcrypt is deliberately *not* used for these tokens: it truncates input to 72 bytes, and JWTs for the same user share that prefix, so every token would have produced the same hash.

**One source of truth for prices.** `PricingService` turns a subtotal into `{ subtotal, shippingFee, total }` using `SHIPPING_FEE` and `FREE_SHIPPING_THRESHOLD`, rounding to whole cents. The cart uses it for its summary and order creation uses it for the stored amounts, so the storefront never has to calculate money on its own.

**Deleting without breaking history.** Cart lines reference products with `ON DELETE CASCADE`, so a deleted product simply disappears from carts. Order lines use `ON DELETE SET NULL` and already keep `productName` and `unitPrice`, so past orders still show what was bought and for how much. Categories that still contain products are rejected with `409 Conflict` instead of failing on a foreign-key error.

**Consistent error responses.** All errors go through `GlobalExceptionFilter` and share one shape:

```json
{ "statusCode": 400, "path": "/orders", "timeStamp": "2026-10-05T12:00:00.000Z", "message": "Cart is empty" }
```

Unexpected (non-HTTP) exceptions are logged and returned as a generic `500` without leaking internals.

## API overview

🔒 = requires `Authorization: Bearer <accessToken>` · 👑 = admin only

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/auth/register` | Create an account, returns access + refresh token |
| POST | `/auth/login` | Log in, returns access + refresh token |
| POST | `/auth/refresh` | Exchange a refresh token for a new pair (rotation) |
| POST | `/auth/logout` | Revoke a refresh token |
| GET | `/users/me` 🔒 | Current user's profile |
| GET | `/categories` | List categories |
| GET | `/categories/:id` | Get a category |
| POST · PATCH · DELETE | `/categories[/:id]` 🔒👑 | Manage categories · slug: `a-z`, `0-9`, `-`; duplicate name/slug or deleting a non-empty category → `409` |
| GET | `/products` | List products · query: `search`, `categoryId`, `minPrice`, `maxPrice`, `inStock`, `sort` (`newest`, `price-asc`, `price-desc`, `name`) |
| GET | `/products/:id` | Get a product |
| POST · PATCH · DELETE | `/products[/:id]` 🔒👑 | Manage products |
| GET | `/cart` 🔒 | Get (or lazily create) the user's cart, with `summary: { subtotal, shippingFee, total, freeShippingThreshold }` |
| POST | `/cart/items` 🔒 | Add a product to the cart (rejected with `400` above the available stock) |
| PATCH | `/cart/items/:id` 🔒 | Change an item's quantity |
| DELETE | `/cart/items/:id` 🔒 | Remove an item |
| DELETE | `/cart` 🔒 | Clear the whole cart |
| POST | `/orders` 🔒 | Create an order from the cart · body: `shippingAddress` |
| GET | `/orders` 🔒 | List the user's orders |
| GET | `/orders/admin/all` 🔒👑 | List all orders, newest first |
| GET | `/orders/:id` 🔒 | Get one of the user's orders |
| POST | `/orders/:id/pay` 🔒 | Mark a pending order as paid |
| POST | `/orders/:id/cancel` 🔒 | Cancel a pending order and return stock |
| PATCH | `/orders/:id/ship` 🔒👑 | Mark a paid order as shipped |

## Getting started

**Prerequisites:** Node.js 20+, Docker

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # then set real secrets

# 3. Start PostgreSQL and RabbitMQ
docker compose up -d

# 4. Run the API (http://localhost:3000)
npm run start:dev
```

The RabbitMQ management UI is available at http://localhost:15672.

> **Creating an admin:** new users are registered as `customer`. To try the admin endpoints locally, promote a user in the database:
> ```sql
> UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
> ```
> then log in again so the new role is included in the token.

### Example flow

```bash
# Register and keep the access token
TOKEN=$(curl -s -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"secret123"}' | jq -r .accessToken)

# Add a product to the cart
curl -X POST localhost:3000/cart/items -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"productId":"<product-uuid>","quantity":2}'

# Check out with a shipping address, then pay
curl -X POST localhost:3000/orders -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"shippingAddress":{"firstName":"Jane","lastName":"Doe","email":"jane@example.com","phone":"+49 170 0000000","address":"Main St 1","city":"Frankfurt","district":"Innenstadt"}}'
curl -X POST localhost:3000/orders/<order-uuid>/pay -H "Authorization: Bearer $TOKEN"
```

## Environment variables

| Variable | Description | Example |
| --- | --- | --- |
| `POSTGRES_HOST` / `POSTGRES_PORT` | Database host and port | `localhost` / `5432` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database credentials | `ecommerce` |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` | RabbitMQ credentials | `ecommerce` |
| `RABBITMQ_PORT` / `RABBITMQ_MANAGEMENT_PORT` | Host ports for RabbitMQ (Docker) | `5672` / `15672` |
| `PORT` | HTTP port of the API | `3000` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `SHIPPING_FEE` | Shipping fee below the free-shipping threshold | `4.99` |
| `FREE_SHIPPING_THRESHOLD` | Order subtotal from which shipping is free | `50` |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Access-token secret and lifetime | `15m` |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh-token secret and lifetime | `7d` |

## Testing

```bash
npm run test        # unit tests
npm run test:cov    # coverage report
npm run test:e2e    # end-to-end tests
```

## Project structure

```
src/
├── auth/          # register, login, refresh, logout · JWT strategy · guards · decorators
├── users/         # user entity and profile endpoint
├── categories/    # category CRUD
├── products/      # product CRUD
├── cart/          # per-user cart and cart items
├── orders/        # order lifecycle, stock reservation, event publishing and consumer
├── notifications/ # notifications stored for every order event
├── pricing/       # shipping and total calculation shared by cart and orders
├── common/        # global exception filter, logging interceptor
├── app.module.ts
└── main.ts
```

## Roadmap

Planned next steps:

- **Idempotent payments:** `Idempotency-Key` header and a conditional status update on `/orders/:id/pay`, so retried or concurrent requests cannot double-process a payment
- **Transactional outbox:** publish order events only after the transaction commits, so no event is ever sent for a rolled-back order
- **Durable messaging:** make the queue durable and use manual acknowledgements, so events survive a broker restart and are not lost if the consumer fails
- **Notifications endpoint:** let users read and mark their notifications as read
- **Payment provider integration:** mock provider with signed webhook handling
- **Database migrations:** replace TypeORM `synchronize` with versioned migrations
- **OpenAPI / Swagger** documentation
- **E2E tests** for the full checkout flow, plus a **GitHub Actions** CI pipeline
- Pagination and filtering for product listings

## Author

**Göktürk Turan** · Backend Developer · [gokturkturan.com](https://gokturkturan.com) · [LinkedIn](https://www.linkedin.com/in/gokturkturan/)
