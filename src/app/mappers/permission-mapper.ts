/**
 * Permission Mapper - Converts between Permission domain entities and DTOs
 *
 * Following pattern established in invitation-mapper.ts
 * Ensures proper serialization for Client Components
 */

import { Role } from "@/ddd/domain/rbac/entities/role";
import type { Permission } from "@/ddd/domain/shared/value-objects/permission";

// Plain DTO for client serialization
export interface PermissionDTO {
  id: number;
  resource: string;
  action: string;
  description: string | null;
}

// Maps Permission Value Object to plain DTO
export function toPermissionDTO(permission: Permission): PermissionDTO {
  return {
    id: 0, // Will be set from database rows
    resource: permission.resource,
    action: permission.action,
    description: null, // Will be set from database rows
  };
}

// Maps database row to Permission DTO
export function toPermissionDTOFromRow(row: {
  id: number;
  resource: string;
  action: string;
  description: string | null;
}): PermissionDTO {
  return {
    id: row.id,
    resource: row.resource,
    action: row.action,
    description: row.description,
  };
}

// Role DTO for client serialization
export interface RoleDTO {
  id: number;
  name: string;
  description: string | null;
  organizationId: number | null;
  isSystem: boolean;
  type: 'system' | 'personal' | 'team' | 'custom';
  ownerId: string | null;
  teamId: number | null;
  permissions: PermissionDTO[];
  createdAt: Date;
}

// Maps Role entity to Role DTO
export function toRoleDTO(role: Role): RoleDTO {
  return {
    id: role.id,
    name: role.name,
    description: role.description || null,
    organizationId: role.organizationId?.value || null,
    isSystem: role.isSystem ?? false,
    type: role.type || 'custom',
    ownerId: role.ownerId?.value || null,
    teamId: role.teamId || null,
    permissions: Array.isArray(role.permissions) 
      ? role.permissions.map((p: any) => {
          // If it's already a DTO, return it, otherwise convert
          if (typeof p === 'object' && p !== null && 'resource' in p && 'action' in p) {
            // It's already a DTO-like object
            return {
              id: p.id || 0,
              resource: p.resource,
              action: p.action,
              description: p.description || null
            };
          }
          // It's a Permission VO, convert it
          return toPermissionDTO(p);
        })
      : [],
    createdAt: role.createdAt || new Date(),
  };
}