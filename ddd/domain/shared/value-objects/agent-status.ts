// AIDEV-NOTE: AgentStatus Value Object - type-safe agent status management  
// Replaces primitive string with validated agent lifecycle states

export const AGENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive', 
  DISABLED: 'disabled',
  PENDING: 'pending'
} as const;

export type AgentStatusType = typeof AGENT_STATUS[keyof typeof AGENT_STATUS];

export class AgentStatus {
  private readonly _value: AgentStatusType;

  constructor(value: string) {
    if (!value) {
      throw new Error('Agent status cannot be empty');
    }
    
    if (!this.isValid(value)) {
      throw new Error(`Invalid agent status: ${value}. Must be one of: ${Object.values(AGENT_STATUS).join(', ')}`);
    }
    
    this._value = value as AgentStatusType;
  }

  get value(): string {
    return this._value;
  }

  private isValid(status: string): status is AgentStatusType {
    return Object.values(AGENT_STATUS).includes(status as AgentStatusType);
  }

  static fromString(value: string): AgentStatus {
    return new AgentStatus(value);
  }

  static active(): AgentStatus {
    return new AgentStatus(AGENT_STATUS.ACTIVE);
  }

  static inactive(): AgentStatus {
    return new AgentStatus(AGENT_STATUS.INACTIVE);
  }

  static disabled(): AgentStatus {
    return new AgentStatus(AGENT_STATUS.DISABLED);
  }

  static pending(): AgentStatus {
    return new AgentStatus(AGENT_STATUS.PENDING);
  }

  static isValidStatus(value: string): boolean {
    try {
      new AgentStatus(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if agent can execute tasks
   */
  canExecuteTasks(): boolean {
    return this._value === AGENT_STATUS.ACTIVE;
  }

  /**
   * Check if agent is active
   */
  isActive(): boolean {
    return this._value === AGENT_STATUS.ACTIVE;
  }

  /**
   * Check if agent is inactive
   */
  isInactive(): boolean {
    return this._value === AGENT_STATUS.INACTIVE;
  }

  /**
   * Check if agent is disabled
   */
  isDisabled(): boolean {
    return this._value === AGENT_STATUS.DISABLED;
  }

  /**
   * Check if agent is pending setup
   */
  isPending(): boolean {
    return this._value === AGENT_STATUS.PENDING;
  }

  /**
   * Check if status allows modifications
   */
  allowsModification(): boolean {
    return this._value !== AGENT_STATUS.DISABLED;
  }

  /**
   * Get next logical status transitions
   */
  getPossibleTransitions(): AgentStatus[] {
    switch (this._value) {
      case AGENT_STATUS.PENDING:
        return [AgentStatus.active(), AgentStatus.disabled()];
      case AGENT_STATUS.ACTIVE:
        return [AgentStatus.inactive(), AgentStatus.disabled()];
      case AGENT_STATUS.INACTIVE:
        return [AgentStatus.active(), AgentStatus.disabled()];
      case AGENT_STATUS.DISABLED:
        return [AgentStatus.pending()]; // Can be re-enabled
      default:
        return [];
    }
  }

  /**
   * Check if transition to another status is allowed
   */
  canTransitionTo(newStatus: AgentStatus): boolean {
    const possibleTransitions = this.getPossibleTransitions();
    return possibleTransitions.some(status => status.equals(newStatus));
  }

  equals(other: AgentStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /**
   * Get display name for UI
   */
  getDisplayName(): string {
    switch (this._value) {
      case AGENT_STATUS.ACTIVE: return 'Active';
      case AGENT_STATUS.INACTIVE: return 'Inactive';
      case AGENT_STATUS.DISABLED: return 'Disabled';
      case AGENT_STATUS.PENDING: return 'Pending';
      default: return this._value;
    }
  }

  /**
   * Get CSS class for status display
   */
  getCssClass(): string {
    switch (this._value) {
      case AGENT_STATUS.ACTIVE: return 'status-active';
      case AGENT_STATUS.INACTIVE: return 'status-inactive';
      case AGENT_STATUS.DISABLED: return 'status-disabled';
      case AGENT_STATUS.PENDING: return 'status-pending';
      default: return 'status-unknown';
    }
  }
}