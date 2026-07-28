# Comprehensive Review & Refactor Plan

Scope covers both `backend/` (NestJS) and `frontend/` (React + Vite + Tailwind). Grouped into three workstreams.

---

## 1. Backend — Auth, RBAC, and Error Responses

**Goal:** every endpoint enforces authentication + role checks, and every failure returns a structured JSON error.

### 1a. Apply guards + roles consistently
- `products.controller.ts` — currently only `JwtAuthGuard`. Add `RolesGuard` and `@Roles(...)`:
  - `GET` (list/one/history): all authenticated roles.
  - `POST` / `PATCH`: `admin`, `manager`, `sales`.
  - `DELETE`: `admin`, `manager`.
- `stock.controller.ts`, `stock-documents.controller.ts`, `stock-history.controller.ts` — audit and add role decorators (writes: admin/manager/sales; destructive: admin/manager).
- `barcodes.controller.ts`, `master-data.controller.ts` — ensure `JwtAuthGuard` present; reads allowed to all authenticated.
- `auth.controller.ts` — keep `/login` public; verify no other endpoint is unguarded.
- `users.controller.ts` — already guarded; verify only admin/manager can list/create.

### 1b. Enrich JWT context
- Confirm `JwtStrategy.validate()` returns `{ id, email, name, role }` so `RolesGuard` and controllers reading `req.user.role` work uniformly. Fix if missing.

### 1c. Structured error responses
- Extend `HttpExceptionFilter` to:
  - Preserve validation arrays from `ValidationPipe` (currently flattened via `.message`).
  - Map thrown errors to canonical shape: `{ success: false, statusCode, error: { code, message, details? }, path, timestamp }`.
  - Use `422 Unprocessable Entity` for validation errors (currently `400`), keep `400` for malformed request, `401` unauthorized, `403` forbidden, `404` not found.
- Ensure `RolesGuard` throws `ForbiddenException` with a descriptive message (already does — verify wording).
- Ensure `main.ts` `ValidationPipe` uses `errorHttpStatusCode: 422` and `whitelist: true`.

### 1d. Ownership / tampering checks
- Spot-check services that accept `req.user.email` as `created_by/updated_by` — nothing to change if already using authenticated user (they do).

---

## 2. Frontend — Global Error Handling & Form Validation

### 2a. Global API error interceptor
- `services/api.ts`: expand the response error interceptor to:
  - Parse the new structured error envelope.
  - Show a `sonner` (or existing toast) notification with the human message for every non-2xx (except 401, which still redirects).
  - Attach the parsed error to `error.userMessage` so components can suppress/override when needed.
- Add `<Toaster />` mount in `main.tsx` if not already present (use existing toast lib; project uses no shadcn — add `sonner` or a minimal inline toast component).

### 2b. Field-level validation + helper text
- Introduce lightweight validation helpers (no new dep — hand-rolled with the KSA regexes already in `VendorModal`/`CustomerModal`).
- Update modals/forms with:
  - Inline red helper text under each invalid field.
  - Persistent gray helper text describing constraints (e.g. "10 digits, starts with 3, ends with 3" for VAT; "SA + 22 digits" for IBAN; "Required" for required inputs).
  - Files touched: `ProductModal.tsx`, `VendorModal.tsx`, `CustomerModal.tsx`, `LoginPage.tsx`, `UsersPage.tsx` (create-user form), `StockPage.tsx` (create-stock form if inline).
  - Disable submit until form valid; show top-level error summary from server response.

### 2c. Role-aware UI
- Create `hooks/usePermissions.ts` (thin wrapper around `useAuth` role) exposing helpers: `canWriteProducts`, `canDeleteStock`, `canManageUsers`, etc.
- Use these to:
  - Disable/hide "Add", "Edit", "Delete", "Upload" buttons for unauthorized roles instead of letting the request 403.
  - Show an "Access denied" empty state on pages the user shouldn't see (`UsersPage` for non-admin).

---

## 3. Frontend — Mobile Responsiveness

### 3a. Layout / navigation
- `DashboardLayout.tsx`: convert fixed sidebar to responsive:
  - Desktop (`md:`): current sidebar.
  - Mobile: hamburger button in top bar, off-canvas drawer for nav.
- Ensure header, page padding, and content wrapper use responsive spacing (`px-4 md:px-6`).

### 3b. Data tables → cards on mobile
- `ProductTable.tsx`, `StockPage.tsx` list, `VendorsPage.tsx` list, `CustomersPage.tsx` list, `UsersPage.tsx` list, `HistoryPage.tsx`:
  - Wrap tables in `overflow-x-auto` for tablet.
  - Below `sm:`, render a stacked card list (`hidden md:table` + `md:hidden` card grid) showing key fields + action menu.

### 3c. Modals & forms
- All modal shells: `max-w-full sm:max-w-lg md:max-w-2xl`, `w-[95vw]`, `max-h-[90vh] overflow-y-auto`.
- Grid rows: switch `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.
- Tab strips scroll horizontally on small screens (`overflow-x-auto whitespace-nowrap`).

### 3d. History/lifecycle panels
- `StockHistoryPanel.tsx`, `StockLifecyclePanel.tsx`: ensure they render inside a responsive drawer or full-screen sheet on mobile.

---

## Technical Notes

- No new backend dependencies. Frontend adds `sonner` (~4 KB) for toasts unless a toast lib is already installed — check `frontend/package.json` first and reuse if present.
- No DB migrations required.
- KSA validation regexes reused from existing modals; centralize into `frontend/src/lib/validators.ts`.
- Keep changes additive; do not touch business logic in services beyond the guard/decorator additions.

## Out of Scope

- Rebuilding the router or auth flow.
- Adding automated tests.
- Backend DB schema changes.

## Verification

- Backend: hit each controller with a low-privilege token → expect `403` with structured JSON; hit with no token → `401`; POST invalid DTO → `422` with field-level `details`.
- Frontend: resize preview to 375px width — sidebar collapses, tables become cards, modals fit viewport. Trigger a forbidden action → toast appears. Submit invalid form → inline errors + helper text visible.
