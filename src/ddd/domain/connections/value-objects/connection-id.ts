// AIDEV-NOTE: ConnectionId Value Object - wraps Pipedream account IDs for type safety
// Hides implementation detail of Pipedream account IDs from domain logic

export class ConnectionId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new Error('ConnectionId must be a non-empty string');
    }
    
    if (value.length < 3) {
      throw new Error('ConnectionId must be at least 3 characters');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: ConnectionId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static fromPipedreamId(pipedreamAccountId: string): ConnectionId {
    return new ConnectionId(pipedreamAccountId);
  }
  
  static fromString(value: string): ConnectionId {
    return new ConnectionId(value);
  }
}