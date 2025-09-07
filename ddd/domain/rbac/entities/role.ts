// AIDEV-NOTE: Role entity for RBAC system
// Represents a collection of permissions that can be assigned to users

import { Permission } from '@/ddd/domain/shared/value-objects/permission';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface Role {
  id: number;
  name: string;
  description?: string;
  organizationId?: OrganizationId; // null for system roles
  isSystem: boolean;
  permissions: Permission[];
  createdAt: Date;
}

export interface CreateRoleData {
  name: string;
  description?: string;
  organizationId: OrganizationId;
  permissions: Permission[];
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
  VIEWER: 'Viewer'
} as const;

export type SystemRoleType = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

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