import type { Currency } from './product';

export type PaymentTerm = 'cod' | 'advance' | 'net_15' | 'net_30' | 'net_60' | 'net_90';

export const PAYMENT_TERMS: PaymentTerm[] = [
  'cod',
  'advance',
  'net_15',
  'net_30',
  'net_60',
  'net_90',
];

export const PAYMENT_TERM_LABEL: Record<PaymentTerm, string> = {
  cod: 'Cash on Delivery',
  advance: 'Advance Payment',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_60: 'Net 60',
  net_90: 'Net 90',
};

export type VendorStatus = 'active' | 'inactive';

export type VendorDocType =
  | 'cr'
  | 'vat'
  | 'national_address'
  | 'iban_letter'
  | 'other';

export const VENDOR_DOC_TYPES: VendorDocType[] = [
  'cr',
  'vat',
  'national_address',
  'iban_letter',
  'other',
];

export const VENDOR_DOC_LABEL: Record<VendorDocType, string> = {
  cr: 'Commercial Registration',
  vat: 'VAT Certificate',
  national_address: 'National Address Certificate',
  iban_letter: 'Bank IBAN Letter',
  other: 'Other',
};

export interface VendorDocument {
  id: string;
  vendor_id: string;
  doc_type: VendorDocType;
  file_name: string;
  mime_type: string;
  size: number;
  reference_no: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface Vendor {
  id: string;
  code: string;
  legal_name: string;
  legal_name_ar: string | null;
  cr_number: string;
  vat_number: string | null;
  national_address_code: string | null;
  building_number: string | null;
  street: string | null;
  district: string | null;
  city: string | null;
  postal_code: string | null;
  additional_number: string | null;
  contact_person: string | null;
  phone: string;
  email: string | null;
  iban: string | null;
  bank_name: string | null;
  payment_terms: PaymentTerm;
  lead_time_days: number;
  currency_id: string | null;
  currency: Currency | null;
  status: VendorStatus;
  notes: string | null;
  import_export_license_no?: string | null;
  documents?: VendorDocument[];
  created_at: string;
  updated_at: string;
}

export interface VendorInput {
  legal_name: string;
  legal_name_ar?: string;
  cr_number: string;
  vat_number?: string;
  national_address_code?: string;
  building_number?: string;
  street?: string;
  district?: string;
  city?: string;
  postal_code?: string;
  additional_number?: string;
  contact_person?: string;
  phone: string;
  email?: string;
  iban?: string;
  bank_name?: string;
  payment_terms?: PaymentTerm;
  lead_time_days?: number;
  currency_id?: string;
  status?: VendorStatus;
  notes?: string;
  import_export_license_no?: string;
}

export interface VendorPage {
  items: Vendor[];
  total: number;
  page: number;
  limit: number;
}
