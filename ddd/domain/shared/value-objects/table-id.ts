// AIDEV-NOTE: Value object for table identity
import { BaseId } from './base-id';

export class TableId extends BaseId<'TableId'> {
  constructor(value: number) {
    super(value, 'TableId');
  }

  static fromNumber(value: number): TableId {
    return new TableId(value);
  }

  static placeholder(): TableId {
    return new TableId(0);
  }
}