// AIDEV-NOTE: Value object for organization identity
// Provides type safety and domain validation for organization IDs

import { BaseId } from './base-id';

export class OrganizationId extends BaseId<'OrganizationId'> {
  constructor(value: number) {
    super(value, 'OrganizationId');
  }

  static fromNumber(value: number): OrganizationId {
    return new OrganizationId(value);
  }
}