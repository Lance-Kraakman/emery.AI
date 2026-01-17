// AIDEV-NOTE: Value object for template identity
import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

export class TemplateId extends BaseId<'TemplateId'> {
  constructor(value: number) {
    super(value, 'TemplateId');
  }

  static fromNumber(value: number): TemplateId {
    return new TemplateId(value);
  }

  static temporary(): TemplateId {
    // Use negative values for temporary IDs to distinguish from real IDs
    return new TemplateId(-1);
  }
}
