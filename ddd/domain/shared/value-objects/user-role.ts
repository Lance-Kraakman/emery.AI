// AIDEV-NOTE: Simplified 3-role system replacing complex roles table
// Uses fixed roles: owner, admin, member with predefined capabilities

import { ORGANIZATION_ROLES, type OrganizationRoleType } from '@/ddd/domain/shared/value-objects/organization-role';

export interface UserRoleCapabilities {
  // Organization Management
  canManageOrganization: boolean;
  canViewOrganization: boolean;
  
  // User Management  
  canManageUsers: boolean;
  canViewUsers: boolean;
  canInviteUsers: boolean;
  
  // Agent Management
  canCreateAgents: boolean;
  canManageAgents: boolean;
  canViewAgents: boolean;
  canExecuteAgents: boolean;
  
  // Team Management
  canCreateTeams: boolean;
  canManageTeams: boolean;
  canViewTeams: boolean;
  
  // Data Management
  canViewData: boolean;
  canManageData: boolean;
  canCreateTables: boolean;
  canManageTables: boolean;
  canEditTableData: boolean;
}

export class UserRole {
  private readonly _role: OrganizationRoleType;
  private readonly _capabilities: UserRoleCapabilities;

  constructor(role: OrganizationRoleType) {
    this._role = role;
    this._capabilities = this.calculateCapabilities(role);
  }

  get role(): OrganizationRoleType {
    return this._role;
  }

  get capabilities(): UserRoleCapabilities {
    return { ...this._capabilities }; // Return copy to prevent mutation
  }

  private calculateCapabilities(role: OrganizationRoleType): UserRoleCapabilities {
    switch (role) {
      case ORGANIZATION_ROLES.OWNER:
        return {
          // Full access to everything
          canManageOrganization: true,
          canViewOrganization: true,
          canManageUsers: true,
          canViewUsers: true,
          canInviteUsers: true,
          canCreateAgents: true,
          canManageAgents: true,
          canViewAgents: true,
          canExecuteAgents: true,
          canCreateTeams: true,
          canManageTeams: true,
          canViewTeams: true,
          canViewData: true,
          canManageData: true,
          canCreateTables: true,
          canManageTables: true,
          canEditTableData: true,
        };

      case ORGANIZATION_ROLES.ADMIN:
        return {
          // Management access excluding organization settings
          canManageOrganization: false,
          canViewOrganization: true,
          canManageUsers: true,
          canViewUsers: true,
          canInviteUsers: true,
          canCreateAgents: true,
          canManageAgents: true,
          canViewAgents: true,
          canExecuteAgents: true,
          canCreateTeams: true,
          canManageTeams: true,
          canViewTeams: true,
          canViewData: true,
          canManageData: true,
          canCreateTables: true,
          canManageTables: true,
          canEditTableData: true,
        };

      case ORGANIZATION_ROLES.MEMBER:
        return {
          // Limited read/execute access
          canManageOrganization: false,
          canViewOrganization: true,
          canManageUsers: false,
          canViewUsers: true,
          canInviteUsers: false,
          canCreateAgents: false,
          canManageAgents: false,
          canViewAgents: true,
          canExecuteAgents: true,
          canCreateTeams: false,
          canManageTeams: false,
          canViewTeams: true,
          canViewData: true,
          canManageData: false,
          canCreateTables: false,
          canManageTables: false,
          canEditTableData: true, // Can edit data but not structure
        };

      default:
        // Default to member capabilities for safety
        return this.calculateCapabilities(ORGANIZATION_ROLES.MEMBER);
    }
  }

  static fromString(role: string): UserRole {
    if (!ORGANIZATION_ROLES[role.toUpperCase() as keyof typeof ORGANIZATION_ROLES]) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${Object.values(ORGANIZATION_ROLES).join(', ')}`);
    }
    return new UserRole(role as OrganizationRoleType);
  }

  static owner(): UserRole {
    return new UserRole(ORGANIZATION_ROLES.OWNER);
  }

  static admin(): UserRole {
    return new UserRole(ORGANIZATION_ROLES.ADMIN);
  }

  static member(): UserRole {
    return new UserRole(ORGANIZATION_ROLES.MEMBER);
  }

  hasCapability(capability: keyof UserRoleCapabilities): boolean {
    return this._capabilities[capability];
  }

  isOwner(): boolean {
    return this._role === ORGANIZATION_ROLES.OWNER;
  }

  isAdmin(): boolean {
    return this._role === ORGANIZATION_ROLES.ADMIN;
  }

  isMember(): boolean {
    return this._role === ORGANIZATION_ROLES.MEMBER;
  }

  isAdministrative(): boolean {
    return this.isOwner() || this.isAdmin();
  }

  getHierarchyLevel(): number {
    switch (this._role) {
      case ORGANIZATION_ROLES.OWNER: return 3;
      case ORGANIZATION_ROLES.ADMIN: return 2;
      case ORGANIZATION_ROLES.MEMBER: return 1;
      default: return 0;
    }
  }

  hasHigherPrivilegesThan(other: UserRole): boolean {
    return this.getHierarchyLevel() > other.getHierarchyLevel();
  }

  equals(other: UserRole): boolean {
    return this._role === other._role;
  }

  toString(): string {
    return this._role;
  }
}