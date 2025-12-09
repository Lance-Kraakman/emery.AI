// AIDEV-NOTE: Template ID value object for type-safe template identification
// Extends BaseId pattern used throughout the domain layer

import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

export class TemplateId extends BaseId<'TemplateId'> {
  private constructor(value: number) {
    super(value, 'TemplateId');
  }

  static fromNumber(value: number): TemplateId {
    return new TemplateId(value);
  }

  static temporary(): TemplateId {
    // Use -1 for temporary IDs to distinguish from real IDs
    // BaseId allows -1 as a special case for new entities
    return new TemplateId(-1);
  }
}
