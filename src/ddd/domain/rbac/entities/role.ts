// AIDEV-NOTE: Role entity for RBAC system
// Represents a collection of permissions that can be assigned to users

import { Permission } from '@/ddd/domain/shared/value-objects/permission';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export type RoleType = 'system' | 'personal' | 'team' | 'custom';

export interface Role {
  id: number;
  name: string;
  description?: string;
  organizationId?: OrganizationId; // null for system roles
  isSystem: boolean;
  type: RoleType; // Role type: system, personal, team, or custom
  ownerId?: UserId; // User ID for personal roles, null for other types
  teamId?: number; // Team ID for team roles, null for other types
  permissions: Permission[];
  createdAt: Date;
}

export interface CreateRoleData {
  name: string;
  description?: string;
  organizationId: OrganizationId;
  permissions: Permission[];
  type?: 'personal' | 'team' | 'custom'; // System roles can't be created via this interface
  ownerId?: UserId; // Required for personal roles
  teamId?: number; // Required for team roles
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  permissions?: Permission[];
}

// System role definitions
export const SYSTEM_ROLES = {
  ORGANIZATION_OWNER: 'Organization Owner',
  ORGANIZATION_ADMIN: 'Organization Admin',
  TEAM_LEAD: 'Team Lead',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
  SYSTEM_SERVICE: 'System Service'
} as const;

export type SystemRoleType = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

// System role database IDs (seeded values - must match database)
// AIDEV-NOTE: These IDs correspond to the seeded system roles in the database
export const SYSTEM_ROLE_IDS = {
  ORGANIZATION_OWNER: 1,
  ORGANIZATION_ADMIN: 2,
  TEAM_LEAD: 3,
  MEMBER: 4,
  VIEWER: 5,
  SYSTEM_SERVICE: 6
} as const;

export type SystemRoleId = typeof SYSTEM_ROLE_IDS[keyof typeof SYSTEM_ROLE_IDS];

// Helper functions for role validation
export function isSystemRole(roleName: string): boolean {
  return Object.values(SYSTEM_ROLES).includes(roleName as SystemRoleType);
}

export function validateRoleName(name: string): boolean {
  return name.length >= 3 && name.length <= 50;
}

export function canModifyRole(role: Role): boolean {
  return !role.isSystem; // Only custom roles can be modified
}