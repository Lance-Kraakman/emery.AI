import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

/**
 * SecurityFindingId Value Object
 *
 * Unique identifier for SecurityFinding entities.
 * Enforces type safety and validation for security finding IDs.
 */
export class SecurityFindingId extends BaseId<'SecurityFindingId'> {
  private constructor(value: number, readonly brand: 'SecurityFindingId') {
    super(value, brand);
  }

  static fromNumber(value: number): SecurityFindingId {
    if (value <= 0) {
      throw new Error('SecurityFindingId must be a positive integer');
    }
    return new SecurityFindingId(value, 'SecurityFindingId');
  }

  static fromString(value: string): SecurityFindingId {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error('SecurityFindingId must be a valid number');
    }
    return SecurityFindingId.fromNumber(num);
  }
}
