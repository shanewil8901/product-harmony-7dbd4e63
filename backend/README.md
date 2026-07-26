# Product Management — Backend (NestJS + TypeORM + MySQL)

## Setup

```bash
cp .env.example .env
npm install
npm run start:dev
```

MySQL must be running locally. `synchronize: true` auto-creates the `products` and `users` tables on first run. Turn this off and use migrations before production.

- API base: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api/docs`

## Auth

- `POST /api/v1/auth/register` — `{ email, name, password }`
- `POST /api/v1/auth/login` — `{ email, password }` → `{ access_token, user }`
- `GET  /api/v1/auth/me` — requires `Authorization: Bearer <token>`

## Products (all require Bearer token)

- `GET    /api/v1/products?search=<term>&page=1&limit=20` — `search` filters by `productCode` OR `product_barcode`
- `GET    /api/v1/products/:id`
- `POST   /api/v1/products`
- `PATCH  /api/v1/products/:id`
- `DELETE /api/v1/products/:id` (soft delete — sets `deleted_at` / `deleted_by`)

## Response envelope

Every success response is wrapped by `ResponseInterceptor`:

```json
{
  "success": true,
  "statusCode": 200,
  "path": "/api/v1/products",
  "timestamp": "2026-07-20T12:00:00.000Z",
  "data": { ... }
}
```

Errors go through `HttpExceptionFilter` with the same shape and `success: false`.

## Validation

`class-validator` DTOs enforce the DB precision:
- `baseQty`, `weight` — max 3 decimal places
- `buyingPrice`, `sellingPrice` — max 2 decimal places
- `productCode` — required, ≤ 255, unique
- `product_barcode` — optional, ≤ 255, indexed
