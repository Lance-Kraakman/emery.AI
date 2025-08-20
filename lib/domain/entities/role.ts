export interface Role {
  id: number;
  name: string;
  permissions?: string[] | null;
  organizationId?: number | null;
  createdAt?: Date | null;
}

export interface CreateRoleData {
  name: string;
  permissions?: string[];
  organizationId?: number;
}

export interface UpdateRoleData extends Partial<CreateRoleData> {}

// Standard role types
export const ROLE_TYPES = {
  OWNER: 'owner',
  ADMIN: 'admin', 
  MEMBER: 'member'
} as const;

export type RoleType = typeof ROLE_TYPES[keyof typeof ROLE_TYPES];

// Standard permissions
export const PERMISSIONS = {
  ALL: 'all',
  CREATE_AGENTS: 'create_agents',
  MANAGE_USERS: 'manage_users',
  MANAGE_TABLES: 'manage_tables',
  VIEW_TABLES: 'view_tables',
  EDIT_TABLES: 'edit_tables'
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];