// AIDEV-NOTE: Value object for agent identity
// Provides type safety and domain validation for agent IDs

import { BaseId } from './base-id';

export class AgentId extends BaseId<'AgentId'> {
  constructor(value: number) {
    super(value, 'AgentId');
  }

  static fromNumber(value: number): AgentId {
    return new AgentId(value);
  }

  /**
   * Create an AgentId for a new entity (allows 0 as placeholder before persistence)
   */
  static newEntity(): AgentId {
    return this.createNew('AgentId', 0) as AgentId;
  }
}