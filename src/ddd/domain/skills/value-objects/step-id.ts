import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

/**
 * StepId Value Object
 *
 * Unique identifier for Step entities within capabilities.
 * Enforces type safety and validation for step IDs.
 */
export class StepId extends BaseId<'StepId'> {
  private constructor(value: number, readonly brand: 'StepId') {
    super(value, brand);
  }

  static fromNumber(value: number): StepId {
    if (value <= 0) {
      throw new Error('StepId must be a positive integer');
    }
    return new StepId(value, 'StepId');
  }

  static fromString(value: string): StepId {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error('StepId must be a valid number');
    }
    return StepId.fromNumber(num);
  }
}
