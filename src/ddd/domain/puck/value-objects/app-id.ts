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

  static create(): AppId {
    // Create a new AppId with 0 as placeholder before persistence
    return BaseId.createNew('AppId', 0) as AppId;
  }
}
