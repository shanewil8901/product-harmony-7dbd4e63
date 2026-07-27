import type { Currency } from './product';
import type { PaymentTerm } from './vendor';

export { PAYMENT_TERMS, PAYMENT_TERM_LABEL } from './vendor';
export type { PaymentTerm } from './vendor';

export type CustomerType = 'individual' | 'business';
export type CustomerStatus = 'active' | 'inactive';

export type CustomerDocType =
  | 'cr'
  | 'vat'
  | 'national_id'
  | 'iqama'
  | 'national_address'
  | 'other';

export const CUSTOMER_DOC_TYPES: CustomerDocType[] = [
  'cr',
  'vat',
  'national_id',
  'iqama',
  'national_address',
  'other',
];

export const CUSTOMER_DOC_LABEL: Record<CustomerDocType, string> = {
  cr: 'Commercial Registration',
  vat: 'VAT Certificate',
  national_id: 'National ID',
  iqama: 'Iqama',
  national_address: 'National Address Certificate',
  other: 'Other',
};

export interface CustomerDocument {
  id: string;
  customer_id: string;
  doc_type: CustomerDocType;
  file_name: string;
  mime_type: string;
  size: number;
  reference_no: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface Customer {
  id: string;
  code: string;
  customer_type: CustomerType;
  legal_name: string;
  legal_name_ar: string | null;
  cr_number: string | null;
  vat_number: string | null;
  national_id: string | null;
  national_address_code: string | null;
  phone: string;
  email: string | null;
  billing_building_number: string | null;
  billing_street: string | null;
  billing_district: string | null;
  billing_city: string | null;
  billing_postal_code: string | null;
  billing_additional_number: string | null;
  shipping_same_as_billing: boolean;
  shipping_building_number: string | null;
  shipping_street: string | null;
  shipping_district: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_additional_number: string | null;
  credit_limit: string;
  currency_id: string | null;
  currency: Currency | null;
  payment_terms: PaymentTerm;
  status: CustomerStatus;
  notes: string | null;
  documents?: CustomerDocument[];
  created_at: string;
  updated_at: string;
}

export interface CustomerInput {
  customer_type: CustomerType;
  legal_name: string;
  legal_name_ar?: string;
  cr_number?: string;
  vat_number?: string;
  national_id?: string;
  national_address_code?: string;
  phone: string;
  email?: string;
  billing_building_number?: string;
  billing_street?: string;
  billing_district?: string;
  billing_city?: string;
  billing_postal_code?: string;
  billing_additional_number?: string;
  shipping_same_as_billing?: boolean;
  shipping_building_number?: string;
  shipping_street?: string;
  shipping_district?: string;
  shipping_city?: string;
  shipping_postal_code?: string;
  shipping_additional_number?: string;
  credit_limit?: number;
  currency_id?: string;
  payment_terms?: PaymentTerm;
  status?: CustomerStatus;
  notes?: string;
}

export interface CustomerPage {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
}
