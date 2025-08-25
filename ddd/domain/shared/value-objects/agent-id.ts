// AIDEV-NOTE: Value object for agent identity
// Provides type safety and domain validation for agent IDs

export class AgentId {
  private readonly _value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('AgentId must be a non-negative integer');
    }
    
    this._value = value;
  }

  get value(): number {
    return this._value;
  }

  equals(other: AgentId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }

  static fromNumber(value: number): AgentId {
    return new AgentId(value);
  }

  static placeholder(): AgentId {
    return new AgentId(0);
  }
}