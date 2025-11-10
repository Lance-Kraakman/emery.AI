// AIDEV-NOTE: PuckPage ID value object for type-safe page identification
// Extends BaseId pattern used throughout the domain layer

import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

export class PageId extends BaseId<'PageId'> {
  private constructor(value: number) {
    super(value, 'PageId');
  }

  static fromNumber(value: number): PageId {
    return new PageId(value);
  }

  static create(): PageId {
    // Create a new PageId with 0 as placeholder before persistence
    return BaseId.createNew('PageId', 0) as PageId;
  }
}
