// AIDEV-NOTE: Value object for team identity
// Provides type safety and domain validation for team IDs

export class TeamId {
  private readonly _value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('TeamId must be a positive integer');
    }
    
    this._value = value;
  }

  get value(): number {
    return this._value;
  }

  equals(other: TeamId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }

  static fromNumber(value: number): TeamId {
    return new TeamId(value);
  }
}