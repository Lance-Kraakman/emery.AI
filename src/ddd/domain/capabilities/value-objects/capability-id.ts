import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

/**
 * CapabilityId Value Object
 *
 * Unique identifier for Capability entities.
 * Enforces type safety and validation for capability IDs.
 */
export class CapabilityId extends BaseId<'CapabilityId'> {
  private constructor(value: number, readonly brand: 'CapabilityId') {
    super(value, brand);
  }

  static fromNumber(value: number): CapabilityId {
    if (value <= 0) {
      throw new Error('CapabilityId must be a positive integer');
    }
    return new CapabilityId(value, 'CapabilityId');
  }

  static fromString(value: string): CapabilityId {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error('CapabilityId must be a valid number');
    }
    return CapabilityId.fromNumber(num);
  }
}
