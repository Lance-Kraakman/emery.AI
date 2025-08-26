// AIDEV-NOTE: Value object for team identity
// Provides type safety and domain validation for team IDs

import { BaseId } from './base-id';

export class TeamId extends BaseId<'TeamId'> {
  constructor(value: number) {
    super(value, 'TeamId', true); // Allow zero for placeholder
  }

  static fromNumber(value: number): TeamId {
    return new TeamId(value);
  }

  static placeholder(): TeamId {
    return new TeamId(0);
  }
}