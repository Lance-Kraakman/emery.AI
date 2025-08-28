// AIDEV-NOTE: Value object for field identity
import { BaseId } from './base-id';

export class FieldId extends BaseId<'FieldId'> {
  constructor(value: number) {
    super(value, 'FieldId');
  }

  static fromNumber(value: number): FieldId {
    return new FieldId(value);
  }

}