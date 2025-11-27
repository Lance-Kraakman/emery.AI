// AIDEV-NOTE: Value object for credential delegation identity
// Provides type safety and domain validation for delegation IDs

import { BaseId } from './base-id';

export class DelegationId extends BaseId<'DelegationId'> {
  constructor(value: number) {
    super(value, 'DelegationId');
  }

  static fromNumber(value: number): DelegationId {
    return new DelegationId(value);
  }

  static newEntity(): DelegationId {
    return this.createNew('DelegationId', 0) as DelegationId;
  }
}
