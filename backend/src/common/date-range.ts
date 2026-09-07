import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Compares two YYYY-MM-DD strings. Returns true when `to` is the same day as
 * `from` or later. Missing / malformed values are treated as "nothing to
 * compare" so the field's own @IsDateString reports the error instead.
 */
export function isSameOrAfter(to: unknown, from: unknown): boolean {
  if (!isIsoDate(to) || !isIsoDate(from)) return true;
  return to >= from;
}

/**
 * Server-side guard for from/to pairs: the decorated property must not be
 * earlier than the referenced property.
 */
export function IsNotBeforeDate(property: string, options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotBeforeDate',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const related = (args.object as Record<string, unknown>)[args.constraints[0] as string];
          return isSameOrAfter(value, related);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} cannot be earlier than ${args.constraints[0]}`;
        },
      },
    });
  };
}
