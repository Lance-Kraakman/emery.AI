// AIDEV-NOTE: Value object for agent identity
// Provides type safety and domain validation for agent IDs

import { BaseId } from './base-id';

export class AgentId extends BaseId<'AgentId'> {
  constructor(value: number) {
    super(value, 'AgentId', true); // Allow zero for placeholder
  }

  static fromNumber(value: number): AgentId {
    return new AgentId(value);
  }

  static placeholder(): AgentId {
    return new AgentId(0);
  }
}