# Vendors & Customers Modules (Saudi KSA Compliant)

Add two new full-stack modules with dedicated screens, Saudi-specific fields, and document upload support.

## Saudi Compliance Fields

**Vendors (Suppliers):**
- Legal name (English + Arabic)
- Commercial Registration (CR) number — 10 digits
- VAT registration number — 15 digits, starts/ends with 3
- National Address (short code + building/street/district/city/postal code/additional)
- Contact person, phone (+966), email
- IBAN (SA + 22 digits), bank name
- Payment terms (Net 30/60/90/COD), lead time (days), currency
- Status (active/inactive)
- **Documents:** CR certificate, VAT certificate, National Address certificate, Bank IBAN letter

**Customers:**
- Customer type (individual / business)
- Legal name (English + Arabic)
- CR number (business only), VAT number (business, optional)
- National ID / Iqama (individual, 10 digits)
- National Address, phone (+966), email
- Billing address, shipping address
- Credit limit + currency, payment terms
- Status (active/inactive)
- **Documents:** CR (business), VAT cert (business), National ID/Iqama copy (individual), National Address

## Backend (NestJS + TypeORM)

New modules `vendors/` and `customers/` mirroring existing patterns:
- `vendor.entity.ts`, `customer.entity.ts` with all fields above
- `vendor-document.entity.ts`, `customer-document.entity.ts` (id, parent_id, doc_type enum, file_name, mime_type, size, storage_path, uploaded_at, uploaded_by)
- DTOs with `class-validator`: regex for CR (`^\d{10}$`), VAT (`^3\d{13}3$`), IBAN (`^SA\d{22}$`), phone (`^\+9665\d{8}$`), National Address short code (`^[A-Z]{4}\d{4}$`)
- Controllers: full CRUD + `POST /:id/documents` (multer disk storage under `backend/uploads/{vendors|customers}/{id}/`), `GET /:id/documents`, `GET /:id/documents/:docId/download`, `DELETE /:id/documents/:docId`
- Role guard: admin/manager can create/update/delete; all authenticated can read
- Register in `app.module.ts`

## Frontend (React)

- `types/vendor.ts`, `types/customer.ts`
- `services/vendors.service.ts`, `services/customers.service.ts` (multipart upload for docs)
- `pages/VendorsPage.tsx`, `pages/CustomersPage.tsx` — list + search + create/edit modal
- `components/VendorModal.tsx`, `components/CustomerModal.tsx` — tabbed form (Info / Address / Financial / Documents) with inline validation matching backend regex
- `components/DocumentUploader.tsx` — reusable list + upload + download + delete
- Nav links in `DashboardLayout` (admin/manager see full CRUD; others read-only)
- Routes in `router.tsx`

## Notes
- No changes to existing modules.
- File storage: local disk (`backend/uploads/`), gitignored. Add `MAX_UPLOAD_MB=10` env, accept PDF/JPG/PNG.
- Vendor picker in Stock module keeps working (already stores vendor_name); optional future step to link `vendor_id`.
