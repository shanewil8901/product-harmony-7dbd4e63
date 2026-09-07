/**
 * KSA-specific regex validators shared across vendor/customer/product forms.
 * Mirrors backend DTO regexes to keep client + server validation aligned.
 */
export const KSA = {
  CR: /^\d{10}$/,
  VAT: /^3\d{13}3$/,
  PHONE: /^\+9665\d{8}$/,
  IBAN: /^SA\d{22}$/,
  NATIONAL_ID: /^[12]\d{9}$/,
  NATIONAL_ADDRESS: /^[A-Z]{4}\d{4}$/,
  POSTAL: /^\d{5}$/,
  ADDL: /^\d{4}$/,
};

export const HELP = {
  CR: '10 digits (Saudi Commercial Registration)',
  VAT: '15 digits, starts and ends with 3',
  PHONE: 'International format: +9665XXXXXXXX',
  IBAN: 'SA followed by 22 digits',
  NATIONAL_ID: '10 digits, starts with 1 (citizen) or 2 (Iqama)',
  NATIONAL_ADDRESS: '4 uppercase letters + 4 digits (e.g. RRRD1234)',
  POSTAL: '5-digit postal code',
  ADDL: '4-digit additional number',
  EMAIL: 'name@example.com',
  PASSWORD: 'Minimum 6 characters',
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------------------------------------------------- KSA mobile */

/** Local display/entry format: 10 digits starting with 05. */
export const KSA_MOBILE_LOCAL = /^05\d{8}$/;

/** Accepts 05XXXXXXXX or 5XXXXXXXX (leading zero optional). */
export function isKsaMobileLocal(value: string) {
  const v = (value ?? '').replace(/\D/g, '');
  return /^0?5\d{8}$/.test(v);
}

/** Anything the user may type (or the API may return) -> 05XXXXXXXX. */
export function toLocalMobile(value?: string | null) {
  if (!value) return '';
  let v = value.replace(/[\s\-()]/g, '');
  if (v.startsWith('+966')) v = v.slice(4);
  else if (v.startsWith('00966')) v = v.slice(5);
  else if (v.startsWith('966')) v = v.slice(3);
  v = v.replace(/\D/g, '');
  if (/^0?5\d{8}$/.test(v)) return v.startsWith('0') ? v : `0${v}`;
  return v;
}

export const MOBILE_HELP = '10 digits starting with 05 (e.g. 0501234567)';
