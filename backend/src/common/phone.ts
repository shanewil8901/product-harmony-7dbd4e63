import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/** Canonical storage format for KSA mobiles. */
export const KSA_PHONE_RE = /^\+9665\d{8}$/;

/**
 * The UI sends the local 10-digit format (05XXXXXXXX). Older clients (and
 * previously stored values) may still send +9665XXXXXXXX, and users sometimes
 * drop the leading zero (5XXXXXXXX). All three are accepted and normalised to
 * the canonical +9665XXXXXXXX before validation runs.
 */
export function normalizeKsaMobile(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  let v = value.replace(/[\s\-()]/g, '');
  if (!v) return v;
  if (v.startsWith('00966')) v = `+${v.slice(2)}`;
  if (v.startsWith('966')) v = `+${v}`;
  if (v.startsWith('+966')) {
    const rest = v.slice(4).replace(/^0+/, '');
    return `+966${rest}`;
  }
  // Local formats: 05XXXXXXXX or 5XXXXXXXX
  if (/^0\d{9}$/.test(v)) return `+966${v.slice(1)}`;
  if (/^\d{9}$/.test(v)) return `+966${v}`;
  return v;
}

/** Normalises then validates a KSA mobile number. */
export function IsKsaMobile(message = 'Mobile must be 10 digits starting with 05 (e.g. 0501234567)') {
  return applyDecorators(
    Transform(({ value }) => normalizeKsaMobile(value)),
    Matches(KSA_PHONE_RE, { message }),
  );
}
