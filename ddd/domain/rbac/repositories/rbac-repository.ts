// AIDEV-NOTE: RBAC repository interface for permission and role management
// Defines contracts for RBAC operations including permission checking, role management

import { Permission } from '@/ddd/domain/shared/value-objects/permission';
import { UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { Role, CreateRoleData, UpdateRoleData } from '@/ddd/domain/rbac/entities/role';

export interface IRBACRepository {
  // Permission checking - core RBAC functionality
  hasPermission(userId: UserId, permission: Permission, organizationId: OrganizationId): Promise<boolean>;
  requirePermission(userId: UserId, permission: Permission, organizationId: OrganizationId): Promise<void>;
  
  // User permission queries
  getUserPermissions(userId: UserId, organizationId: OrganizationId): Promise<Permission[]>;
  getUserRoles(userId: UserId, organizationId: OrganizationId): Promise<Role[]>;
  
  // Role management
  createRole(data: CreateRoleData): Promise<Role>;
  updateRole(roleId: number, data: UpdateRoleData): Promise<Role>;
  deleteRole(roleId: number): Promise<void>;
  findRoleById(id: number): Promise<Role | null>;
  findRolesByOrganization(organizationId: OrganizationId): Promise<Role[]>;
  getSystemRoles(): Promise<Role[]>;
  
  // Role-permission assignment
  addPermissionsToRole(roleId: number, permissions: Permission[]): Promise<void>;
  removePermissionsFromRole(roleId: number, permissions: Permission[]): Promise<void>;
  setRolePermissions(roleId: number, permissions: Permission[]): Promise<void>;
  
  // User-role assignment
  assignRole(userId: UserId, roleId: number, organizationId: OrganizationId): Promise<void>;
  removeRole(userId: UserId, roleId: number, organizationId: OrganizationId): Promise<void>;
  setUserRoles(userId: UserId, roleIds: number[], organizationId: OrganizationId): Promise<void>;
  
  // Permission seeding and management
  getAllPermissions(): Promise<Permission[]>;
  seedPermissions(): Promise<void>;
  seedSystemRoles(): Promise<void>;
}