import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * RSK-02: chỉ nhận chuỗi ISO-8601 có múi giờ rõ ràng (hậu tố Z hoặc +07:00).
 * "2026-11-02T08:00:00" không có múi giờ sẽ bị từ chối, vì server sẽ hiểu sai giờ.
 */
const ISO_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function IsIsoDateTimeWithZone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isIsoDateTimeWithZone',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} phải là ISO-8601 có múi giờ, ví dụ 2026-11-02T01:00:00Z`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && ISO_WITH_ZONE.test(value) && !Number.isNaN(Date.parse(value)),
      },
    });
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Mã múi giờ IANA, ví dụ Asia/Ho_Chi_Minh. */
export function IsTimeZone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isTimeZone',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} phải là mã múi giờ IANA, ví dụ Asia/Ho_Chi_Minh`, ...options },
      validator: { validate: (value: unknown) => typeof value === 'string' && isValidTimeZone(value) },
    });
}
