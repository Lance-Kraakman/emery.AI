import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

/**
 * SecurityReportId Value Object
 *
 * Unique identifier for SecurityReport entities.
 * Enforces type safety and validation for security report IDs.
 */
export class SecurityReportId extends BaseId<'SecurityReportId'> {
  private constructor(value: number, readonly brand: 'SecurityReportId') {
    super(value, brand);
  }

  static fromNumber(value: number): SecurityReportId {
    if (value <= 0) {
      throw new Error('SecurityReportId must be a positive integer');
    }
    return new SecurityReportId(value, 'SecurityReportId');
  }

  static fromString(value: string): SecurityReportId {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error('SecurityReportId must be a valid number');
    }
    return SecurityReportId.fromNumber(num);
  }
}
