
## Scope
Additive changes only. No existing data touched, no existing routes removed. Existing stock doc types (`po`, `dispatch`, `grn`, `putaway`, `sales_invoice`, `write_off`, `cancellation`) stay in place; new stages are appended, and new lifecycle order slots them into the correct sequence.

---

## 1. Procurement lifecycle

### New `StockDocType` values (appended to existing enum)
`inquiry`, `quotation`, `vendor_invoice`, `payment`, `shipping`, `customs_clearance`, `payment_receipt`

### New `StockStatus` values (appended)
`inquiry_sent`, `quotation_received`, `quotation_approved`, `invoice_received`, `payment_processed`, `shipped`, `customs_cleared`, `settled`

### Updated lifecycle order (in `backend/src/stock/lifecycle.ts`)

```text
inquiry           → inquiry_sent
quotation         → quotation_received      (from: inquiry_sent)
po                → quotation_approved      (from: quotation_received)   [was: ordered]
vendor_invoice    → invoice_received        (from: quotation_approved)
payment           → payment_processed       (from: invoice_received)
shipping          → shipped                 (from: payment_processed)
customs_clearance → customs_cleared         (from: shipped)
grn               → received                (from: customs_cleared)      [was: from in_transit]
putaway           → in_warehouse            (from: received)
sales_invoice     → sold_out                (from: in_warehouse)
payment_receipt   → settled                 (from: sold_out)
write_off         → expired
cancellation      → cancelled
```

`dispatch` remains available but becomes optional/legacy (not required in the new flow). Existing rows using the old flow keep working because their statuses still exist.

### New payload fields (validated in the create-document DTO)

- `payment`: `payment_method` ∈ `LC | BANK_TRANSFER | CHECK | CASH`, `reference_no`, `paid_at`, `amount`.
- `shipping`: `incoterm` ∈ `CIF | FOB | EXW | DDP | CFR | CIP | FCA`, `carrier`, `awb_no`, `eta`.
- `customs_clearance`: `clearance_ref`, `port`, `cleared_at`, `duty_amount`.
- `vendor_invoice`: `invoice_no`, `invoice_date`, `amount`.
- `quotation`: `quote_no`, `quote_date`, `valid_until`, `amount`.
- `inquiry`: `inquiry_no`, `sent_at`, `notes`.
- `payment_receipt`: `receipt_no`, `received_at`, `amount`.

Payloads land in the existing `payload JSON` column — no schema change beyond the enum widening.

### Role permissions in `STAGE_ROLES`
- `inquiry`, `quotation`, `payment`, `payment_receipt`, `shipping`, `customs_clearance`, `vendor_invoice` → `employee` (admin/manager always allowed).

### Auto-PO behavior
Stock creation currently auto-generates a PO with status `ordered`. Change so new stock rows start at `inquiry_sent` with an auto `inquiry` document. This preserves the "one auto doc on creation" pattern while matching the new flow.

### Document templates
Extend `backend/src/stock/document-templates.ts` with labels/prefixes/HTML for each new doc type. Frontend `StockLifecyclePanel` and `StockHistoryPanel` gain the new labels via existing label maps.

---

## 2. Vendor entity

Add two columns to `backend/src/vendors/vendor.entity.ts`:

- `import_export_license_no VARCHAR(64) NULL`
- (document stored via existing `vendor_documents` table using a new `doc_type` value `import_export_license`)

DTO: add `import_export_license_no?: string` (optional at API level; frontend surfaces it as recommended).

Frontend:
- `frontend/src/types/vendor.ts`: add field + new doc type entry.
- `frontend/src/components/VendorModal.tsx`: new input in the Info/Financial tab; add `import_export_license` to allowed uploader types.

---

## 3. Customer entity

No new columns needed (fields already exist). Change validation:

- `backend/src/customers/dto/create-customer.dto.ts`: cross-field rules
  - If `customer_type === 'business'`: `cr_number` and `vat_number` are **required**.
  - `national_id` is **required for all** customer types.
- Frontend `CustomerModal.tsx`: mark those fields required, show inline errors matching backend messages.

Implement via a `@ValidatorConstraint`-based custom decorator or a small `@Transform`/refinement inside the controller (simplest: throw `BadRequestException` in `customers.service.ts` before insert/update). Chose service-level check to avoid DTO gymnastics.

---

## Files touched (all additive)

Backend:
- `backend/src/stock/stock-document.entity.ts` — extend `StockDocType` union + list.
- `backend/src/stock/stock.entity.ts` — extend `StockStatus` union + list.
- `backend/src/stock/lifecycle.ts` — new stages, roles, transitions, labels, prefixes.
- `backend/src/stock/document-templates.ts` — HTML for new stages.
- `backend/src/stock/stock.service.ts` — change auto-doc on create from `po` → `inquiry`.
- `backend/src/stock/dto/create-stock-document.dto.ts` — accept new doc types; no strict payload schema change (payload stays `Record<string, unknown>`).
- `backend/src/vendors/vendor.entity.ts` — new column.
- `backend/src/vendors/dto/create-vendor.dto.ts` — new optional field.
- `backend/src/vendors/vendor-document.entity.ts` — extend doc type union.
- `backend/src/customers/customers.service.ts` — enforce business/individual rules.

Frontend:
- `frontend/src/types/stock.ts` — extend enums + labels.
- `frontend/src/components/StockLifecyclePanel.tsx` — new stage entries in UI (labels + payload fields for payment method + incoterm dropdown).
- `frontend/src/types/vendor.ts` — new field + doc type.
- `frontend/src/components/VendorModal.tsx` — form field + upload category.
- `frontend/src/components/CustomerModal.tsx` — required indicators + inline validation for CR/VAT (business) and national_id (always).

## Risks / notes
- Old stocks with status `ordered` keep working because `ordered` remains a valid status; they simply won't advance under the new `ALLOWED_FROM` unless already past the inquiry/quotation stages. Callers that need to fast-forward legacy rows can use `skipTransitionCheck` (already supported internally).
- Payload validation is intentionally loose (free-form JSON) to avoid a breaking DTO refactor; frontend enforces the required Incoterm/payment-method dropdowns.
