export interface Role {
  id: number;
  name: string;
  permissions: string[];                   // Required permissions array
  organizationId?: number | null;
  createdAt?: Date | null;
}

export interface CreateRoleData {
  name: string;
  permissions: string[];                   // Required permissions array
  organizationId?: number;
}

export interface UpdateRoleData {
  name?: string;
  permissions?: string[];
  organizationId?: number;
}

// Standard role types
export const ROLE_TYPES = {
  OWNER: 'owner',
  ADMIN: 'admin', 
  MEMBER: 'member'
} as const;

export type RoleType = typeof ROLE_TYPES[keyof typeof ROLE_TYPES];

// Enhanced permission system with granular permissions
export const PERMISSIONS = {
  // Organization Management
  MANAGE_ORGANIZATION: 'manage_organization',
  VIEW_ORGANIZATION: 'view_organization',
  
  // User Management  
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  INVITE_USERS: 'invite_users',
  ACCEPT_INVITATIONS: 'accept_invitations',
  VIEW_INVITATIONS: 'view_invitations',
  
  // Table Management
  CREATE_TABLES: 'create_tables',
  MANAGE_TABLES: 'manage_tables',
  VIEW_TABLES: 'view_tables',
  EDIT_TABLE_DATA: 'edit_table_data',
  
  // Agent Management
  CREATE_AGENTS: 'create_agents',
  MANAGE_AGENTS: 'manage_agents',
  VIEW_AGENTS: 'view_agents',
  EXECUTE_AGENTS: 'execute_agents',
  
  // Team Management
  CREATE_TEAMS: 'create_teams',
  MANAGE_TEAMS: 'manage_teams',
  VIEW_TEAMS: 'view_teams',
  
  // Data Management
  VIEW_DATA: 'view_data',
  MANAGE_DATA: 'manage_data',
  
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Default role configurations
export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLE_TYPES.OWNER]: [
    PERMISSIONS.MANAGE_ORGANIZATION,
    PERMISSIONS.VIEW_ORGANIZATION,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.INVITE_USERS,
    PERMISSIONS.ACCEPT_INVITATIONS,
    PERMISSIONS.VIEW_INVITATIONS,
    PERMISSIONS.CREATE_TABLES,
    PERMISSIONS.MANAGE_TABLES,
    PERMISSIONS.VIEW_TABLES,
    PERMISSIONS.EDIT_TABLE_DATA,
    PERMISSIONS.CREATE_AGENTS,
    PERMISSIONS.MANAGE_AGENTS,
    PERMISSIONS.VIEW_AGENTS,
    PERMISSIONS.EXECUTE_AGENTS,
    PERMISSIONS.CREATE_TEAMS,
    PERMISSIONS.MANAGE_TEAMS,
    PERMISSIONS.VIEW_TEAMS,
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.MANAGE_DATA,
  ],
  [ROLE_TYPES.ADMIN]: [
    PERMISSIONS.VIEW_ORGANIZATION,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.INVITE_USERS,
    PERMISSIONS.ACCEPT_INVITATIONS,
    PERMISSIONS.VIEW_INVITATIONS,
    PERMISSIONS.CREATE_TABLES,
    PERMISSIONS.MANAGE_TABLES,
    PERMISSIONS.VIEW_TABLES,
    PERMISSIONS.EDIT_TABLE_DATA,
    PERMISSIONS.CREATE_AGENTS,
    PERMISSIONS.MANAGE_AGENTS,
    PERMISSIONS.VIEW_AGENTS,
    PERMISSIONS.EXECUTE_AGENTS,
    PERMISSIONS.CREATE_TEAMS,
    PERMISSIONS.MANAGE_TEAMS,
    PERMISSIONS.VIEW_TEAMS,
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.MANAGE_DATA,
  ],
  [ROLE_TYPES.MEMBER]: [
    PERMISSIONS.VIEW_ORGANIZATION,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.ACCEPT_INVITATIONS,
    PERMISSIONS.VIEW_INVITATIONS,
    PERMISSIONS.VIEW_TABLES,
    PERMISSIONS.EDIT_TABLE_DATA,
    PERMISSIONS.VIEW_AGENTS,
    PERMISSIONS.EXECUTE_AGENTS,
    PERMISSIONS.VIEW_TEAMS,
    PERMISSIONS.VIEW_DATA,
  ],
} as const;