/**
 * DataSourceId Value Object
 *
 * AIDEV-NOTE: Immutable identifier for data source entities.
 * Follows the same pattern as TableId, AgentId, etc.
 * Extends BaseId for consistent validation and sentinel value handling.
 */

import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

export class DataSourceId extends BaseId<'DataSourceId'> {
  constructor(value: number) {
    super(value, 'DataSourceId');
  }

  static fromNumber(value: number): DataSourceId {
    return new DataSourceId(value);
  }

  static newEntity(): DataSourceId {
    return this.createNew('DataSourceId', 0) as DataSourceId;
  }
}
