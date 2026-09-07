import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { KSA_PHONE_RE, normalizeKsaMobile, IsKsaMobile } from './phone';

class Dto {
  @IsKsaMobile()
  mobile!: string;
}

const check = async (input: unknown) => {
  const dto = plainToInstance(Dto, { mobile: input });
  const errors = await validate(dto);
  return { value: dto.mobile, valid: errors.length === 0 };
};

describe('normalizeKsaMobile', () => {
  it.each([
    ['0501234567', '+966501234567'],
    ['501234567', '+966501234567'],
    ['+966501234567', '+966501234567'],
    ['00966501234567', '+966501234567'],
    ['966501234567', '+966501234567'],
    ['+9660501234567', '+966501234567'],
    ['050 123 4567', '+966501234567'],
    ['050-123-4567', '+966501234567'],
    ['(050) 1234567', '+966501234567'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeKsaMobile(input)).toBe(expected);
  });

  it('leaves non-strings untouched', () => {
    expect(normalizeKsaMobile(undefined)).toBeUndefined();
    expect(normalizeKsaMobile(null)).toBeNull();
    expect(normalizeKsaMobile(12345)).toBe(12345);
  });

  it('produces the canonical storage format', () => {
    expect(KSA_PHONE_RE.test(String(normalizeKsaMobile('0512345678')))).toBe(true);
  });
});

describe('IsKsaMobile validation', () => {
  it.each(['0501234567', '501234567', '+966581234567', '00966591234567'])(
    'accepts %s',
    async (input) => {
      const { valid, value } = await check(input);
      expect(valid).toBe(true);
      expect(value).toMatch(KSA_PHONE_RE);
    },
  );

  it.each([
    '050123456', // too short
    '05012345678', // too long
    '0401234567', // not a mobile prefix
    '+1 555 0100', // wrong country
    'abcdefghij',
    '',
  ])('rejects %s', async (input) => {
    expect((await check(input)).valid).toBe(false);
  });
});
