export interface Product {
  id: string;
  description: string;
  baseQty: string;
  weight: string;
  buyingPrice: string;
  sellingPrice: string;
  productCode: string;
  product_barcode: string | null;
  department_id: string | null;
  base_uom_id: string | null;
  weight_uom_id: string | null;
  buying_currency_id: string | null;
  selling_currency_id: string | null;
  // Enriched by backend joins — safe to render directly.
  department_code?: string | null;
  department_name?: string | null;
  base_uom_code?: string | null;
  base_uom_name?: string | null;
  weight_uom_code?: string | null;
  weight_uom_name?: string | null;
  buying_currency_code?: string | null;
  buying_currency_symbol?: string | null;
  selling_currency_code?: string | null;
  selling_currency_symbol?: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface ProductInput {
  description: string;
  baseQty: number;
  weight: number;
  buyingPrice: number;
  sellingPrice: number;
  department_id: string;
  base_uom_id: string;
  weight_uom_id: string;
  buying_currency_id: string;
  selling_currency_id: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type RoleCode = 'admin' | 'manager' | 'warehouse' | 'sales' | 'employee';

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role | null;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  created_at: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface Uom {
  id: string;
  code: string;
  name: string;
  kind: 'base' | 'weight' | 'both';
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
}
