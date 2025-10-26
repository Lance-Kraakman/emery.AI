import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

/**
 * SkillId Value Object
 *
 * Unique identifier for Skill entities.
 * Enforces type safety and validation for skill IDs.
 */
export class SkillId extends BaseId<'SkillId'> {
  private constructor(value: number, readonly brand: 'SkillId') {
    super(value, brand);
  }

  static fromNumber(value: number): SkillId {
    if (value <= 0) {
      throw new Error('SkillId must be a positive integer');
    }
    return new SkillId(value, 'SkillId');
  }

  static fromString(value: string): SkillId {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error('SkillId must be a valid number');
    }
    return SkillId.fromNumber(num);
  }
}
