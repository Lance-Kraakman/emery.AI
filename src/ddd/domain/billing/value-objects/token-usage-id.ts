/**
 * Token Usage ID Value Object
 */
import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

export class TokenUsageId extends BaseId<'TokenUsageId'> {
  static fromNumber(value: number): TokenUsageId {
    return new TokenUsageId(value, 'TokenUsageId');
  }

  static create(): TokenUsageId {
    // ID will be assigned by database
    return new TokenUsageId(0, 'TokenUsageId');
  }
}
