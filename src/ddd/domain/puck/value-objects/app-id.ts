// AIDEV-NOTE: PuckApp ID value object for type-safe app identification
// Extends BaseId pattern used throughout the domain layer

import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

export class AppId extends BaseId<'AppId'> {
  private constructor(value: number) {
    super(value, 'AppId');
  }

  static fromNumber(value: number): AppId {
    return new AppId(value);
  }

  static temporary(): AppId {
    // Use -1 for temporary IDs to distinguish from real IDs
    // BaseId allows -1 as a special case for new entities
    return new AppId(-1);
  }
}
