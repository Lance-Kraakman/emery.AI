// AIDEV-NOTE: Role repository interface - defines business operations for role and permission management
// Supports enhanced RBAC system with granular permissions and default role creation

import type { 
  Role, 
  CreateRoleData, 
  UpdateRoleData,
  RoleType 
} from '../entities/role';

export interface IRoleRepository {
  // Basic CRUD operations
  findById(id: number): Promise<Role | null>;
  findByOrganization(organizationId: number): Promise<Role[]>;
  findByName(organizationId: number, name: string): Promise<Role | null>;
  create(data: CreateRoleData): Promise<Role>;
  update(id: number, data: UpdateRoleData): Promise<Role>;
  delete(id: number): Promise<void>;
  
  // Permission Management
  hasPermission(roleId: number, permission: string): Promise<boolean>;
  addPermission(roleId: number, permission: string): Promise<void>;
  removePermission(roleId: number, permission: string): Promise<void>;
  addPermissions(roleId: number, permissions: string[]): Promise<void>;
  removePermissions(roleId: number, permissions: string[]): Promise<void>;
  updatePermissions(roleId: number, permissions: string[]): Promise<Role>;
  
  // Standard Role Creation and Management
  createDefaultRoles(organizationId: number): Promise<Role[]>;
  ensureDefaultRoles(organizationId: number): Promise<Role[]>;
  getDefaultRoleByType(organizationId: number, roleType: RoleType): Promise<Role | null>;
  
  // Role Queries
  findRolesByPermission(organizationId: number, permission: string): Promise<Role[]>;
  getUsersWithRole(roleId: number): Promise<string[]>; // Returns user IDs
  getOrganizationRoleHierarchy(organizationId: number): Promise<Role[]>;
  
  // Business Logic Operations
  canDeleteRole(roleId: number): Promise<boolean>;
  validateRolePermissions(permissions: string[]): Promise<{ valid: boolean; invalidPermissions: string[] }>;
  getRolePermissionSummary(roleId: number): Promise<{
    role: Role;
    permissionCount: number;
    userCount: number;
    isSystemRole: boolean;
  }>;
  
  // Bulk Operations
  bulkUpdateRolePermissions(updates: Array<{roleId: number; permissions: string[]}>): Promise<Role[]>;
  cloneRole(sourceRoleId: number, newName: string, organizationId?: number): Promise<Role>;
}