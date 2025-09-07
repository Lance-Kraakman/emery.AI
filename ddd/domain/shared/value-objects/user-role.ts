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
  
  // Ownership-based Agent Management (for members)
  canManageOwnAgents: boolean;
  canViewOwnAgents: boolean;
  
  // Team Management
  canCreateTeams: boolean;
  canManageTeams: boolean;
  canViewTeams: boolean;
  
  // Team-based Access (for members)
  canViewTeamAgents: boolean;
  canViewTeamTasks: boolean;
  canViewTeamData: boolean;
  
  // Task Management
  canCreateTasks: boolean;
  canManageTasks: boolean;
  canViewTasks: boolean;
  canExecuteTasks: boolean;
  
  // Ownership-based Task Management (for members)
  canManageOwnTasks: boolean;
  canViewOwnTasks: boolean;
  
  // Data Management
  canViewData: boolean;
  canManageData: boolean;
  canCreateTables: boolean;
  canManageTables: boolean;
  canEditTableData: boolean;
  
  // Ownership-based Data Management (for members)
  canManageOwnData: boolean;
  
  // Field Management
  canCreateFields: boolean;
  canManageFields: boolean;
  
  // Invitation Management  
  canViewInvitations: boolean;
  canAcceptInvitations: boolean;
  
  // Row/Data Management
  canManageRows: boolean;
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
          canManageOwnAgents: true,
          canViewOwnAgents: true,
          canCreateTeams: true,
          canManageTeams: true,
          canViewTeams: true,
          canViewTeamAgents: true,
          canViewTeamTasks: true,
          canViewTeamData: true,
          canCreateTasks: true,
          canManageTasks: true,
          canViewTasks: true,
          canExecuteTasks: true,
          canManageOwnTasks: true,
          canViewOwnTasks: true,
          canViewData: true,
          canManageData: true,
          canCreateTables: true,
          canManageTables: true,
          canEditTableData: true,
          canManageOwnData: true,
          canCreateFields: true,
          canManageFields: true,
          canViewInvitations: true,
          canAcceptInvitations: true,
          canManageRows: true,
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
          canManageOwnAgents: true,
          canViewOwnAgents: true,
          canCreateTeams: true,
          canManageTeams: true,
          canViewTeams: true,
          canViewTeamAgents: true,
          canViewTeamTasks: true,
          canViewTeamData: true,
          canCreateTasks: true,
          canManageTasks: true,
          canViewTasks: true,
          canExecuteTasks: true,
          canManageOwnTasks: true,
          canViewOwnTasks: true,
          canViewData: true,
          canManageData: true,
          canCreateTables: true,
          canManageTables: true,
          canEditTableData: true,
          canManageOwnData: true,
          canCreateFields: true,
          canManageFields: true,
          canViewInvitations: true,
          canAcceptInvitations: true,
          canManageRows: true,
        };

      case ORGANIZATION_ROLES.MEMBER:
        return {
          // Limited access with ownership and team-based permissions
          canManageOrganization: false,
          canViewOrganization: true,
          canManageUsers: false,
          canViewUsers: true,
          canInviteUsers: false,
          canCreateAgents: true, // Members can create their own agents
          canManageAgents: false, // Cannot manage all agents
          canViewAgents: true,
          canExecuteAgents: true,
          canManageOwnAgents: true, // Can manage their own agents
          canViewOwnAgents: true, // Can view their own agents
          canCreateTeams: false,
          canManageTeams: false,
          canViewTeams: true,
          canViewTeamAgents: true, // Can view team agents
          canViewTeamTasks: true, // Can view team tasks
          canViewTeamData: true, // Can view team data
          canCreateTasks: true, // Members can create their own tasks
          canManageTasks: false, // Cannot manage all tasks
          canViewTasks: true,
          canExecuteTasks: true,
          canManageOwnTasks: true, // Can manage their own tasks
          canViewOwnTasks: true, // Can view their own tasks
          canViewData: true,
          canManageData: false,
          canCreateTables: false,
          canManageTables: false,
          canEditTableData: true, // Can edit data but not structure
          canManageOwnData: true, // Can manage their own data
          canCreateFields: false,
          canManageFields: false,
          canViewInvitations: false,
          canAcceptInvitations: true, // Can accept invitations sent to them
          canManageRows: false,
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