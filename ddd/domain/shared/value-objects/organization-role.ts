// AIDEV-NOTE: OrganizationRole Value Object - type-safe organization role management
// Replaces primitive string with validated business role concepts

export const ORGANIZATION_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin', 
  MEMBER: 'member'
} as const;

export type OrganizationRoleType = typeof ORGANIZATION_ROLES[keyof typeof ORGANIZATION_ROLES];

export class OrganizationRole {
  private readonly _value: OrganizationRoleType;

  constructor(value: string) {
    if (!value) {
      throw new Error('Organization role cannot be empty');
    }
    
    if (!this.isValid(value)) {
      throw new Error(`Invalid organization role: ${value}. Must be one of: ${Object.values(ORGANIZATION_ROLES).join(', ')}`);
    }
    
    this._value = value as OrganizationRoleType;
  }

  get value(): string {
    return this._value;
  }

  private isValid(role: string): role is OrganizationRoleType {
    return Object.values(ORGANIZATION_ROLES).includes(role as OrganizationRoleType);
  }

  static fromString(value: string): OrganizationRole {
    return new OrganizationRole(value);
  }

  static owner(): OrganizationRole {
    return new OrganizationRole(ORGANIZATION_ROLES.OWNER);
  }

  static admin(): OrganizationRole {
    return new OrganizationRole(ORGANIZATION_ROLES.ADMIN);
  }

  static member(): OrganizationRole {
    return new OrganizationRole(ORGANIZATION_ROLES.MEMBER);
  }

  static isValidRole(value: string): boolean {
    try {
      new OrganizationRole(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if this role has administrative privileges
   */
  isAdministrative(): boolean {
    return this._value === ORGANIZATION_ROLES.OWNER || this._value === ORGANIZATION_ROLES.ADMIN;
  }

  /**
   * Check if this role is owner
   */
  isOwner(): boolean {
    return this._value === ORGANIZATION_ROLES.OWNER;
  }

  /**
   * Check if this role is admin
   */
  isAdmin(): boolean {
    return this._value === ORGANIZATION_ROLES.ADMIN;
  }

  /**
   * Check if this role is member
   */
  isMember(): boolean {
    return this._value === ORGANIZATION_ROLES.MEMBER;
  }

  /**
   * Get role hierarchy level (higher number = more privileges)
   */
  getHierarchyLevel(): number {
    switch (this._value) {
      case ORGANIZATION_ROLES.OWNER: return 3;
      case ORGANIZATION_ROLES.ADMIN: return 2;
      case ORGANIZATION_ROLES.MEMBER: return 1;
      default: return 0;
    }
  }

  /**
   * Check if this role has higher privileges than another role
   */
  hasHigherPrivilegesThan(other: OrganizationRole): boolean {
    return this.getHierarchyLevel() > other.getHierarchyLevel();
  }

  equals(other: OrganizationRole): boolean {
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
      case ORGANIZATION_ROLES.OWNER: return 'Owner';
      case ORGANIZATION_ROLES.ADMIN: return 'Administrator';
      case ORGANIZATION_ROLES.MEMBER: return 'Member';
      default: return this._value;
    }
  }
}