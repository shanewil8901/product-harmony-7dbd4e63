# Product Management — Frontend (Vite + React + React Router DOM + Tailwind)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. Requires the backend running on `http://localhost:3000` (or update `VITE_API_URL`).

## Structure

```
src/
  components/       ProtectedRoute, ProductTable, ProductModal
  layouts/          DashboardLayout
  pages/            LoginPage, RegisterPage, ProductsPage
  hooks/            useAuth (context), useProducts (list+CRUD)
  services/         api (axios), auth.service, products.service
  types/            product.ts (Product, ProductInput, Paginated, AuthUser)
  router.tsx        React Router DOM routes
  main.tsx          app entry
```

## Theme

Palette: **white · black · golden yellow · brown · green**. Tokens live in `tailwind.config.js` (`paper`, `ink`, `gold`, `brown`, `forest`) and utility classes in `src/index.css` (`.btn-gold`, `.btn-forest`, `.card`, `.input`, `.label`, …).

## Features

- JWT login / register (token in `localStorage`, auto-attached via axios interceptor)
- Protected `/products` dashboard with:
  - Data table showing every field with formatted decimal precision
  - Debounced search input filtering by `productCode` or `product_barcode`
  - Create + Edit modals with per-field validation (3dp for qty/weight, 2dp for prices, max lengths, required flags)
  - Soft delete with confirmation
  - Pagination
- Envelope response unwrapping (`{ success, data, ... }` → `data`)
- 401 → auto-redirect to `/login`
