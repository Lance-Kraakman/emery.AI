// AIDEV-NOTE: Value object for team identity
// Provides type safety and domain validation for team IDs

import { BaseId } from './base-id';

export class TeamId extends BaseId<'TeamId'> {
  constructor(value: number) {
    super(value, 'TeamId');
  }

  static fromNumber(value: number): TeamId {
    return new TeamId(value);
  }
}