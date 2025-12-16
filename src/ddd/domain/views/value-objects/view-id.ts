/**
 * ViewId Value Object
 *
 * AIDEV-NOTE: Immutable identifier for view entities (formerly DataSource).
 * Views represent filtered/sorted configurations of tables (Baserow view pattern).
 * Follows the same pattern as TableId, AgentId, etc.
 * Extends BaseId for consistent validation and sentinel value handling.
 */

import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

export class ViewId extends BaseId<'ViewId'> {
  constructor(value: number) {
    super(value, 'ViewId');
  }

  static fromNumber(value: number): ViewId {
    return new ViewId(value);
  }

  static newEntity(): ViewId {
    return this.createNew('ViewId', 0) as ViewId;
  }
}
