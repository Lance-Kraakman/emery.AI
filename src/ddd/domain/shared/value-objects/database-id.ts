// AIDEV-NOTE: Value object for database identity
import { BaseId } from './base-id';

export class DatabaseId extends BaseId<'DatabaseId'> {
  constructor(value: number) {
    super(value, 'DatabaseId');
  }

  static fromNumber(value: number): DatabaseId {
    return new DatabaseId(value);
  }

  static temporary(): DatabaseId {
    // Use negative values for temporary IDs to distinguish from real IDs
    return new DatabaseId(-1);
  }

}