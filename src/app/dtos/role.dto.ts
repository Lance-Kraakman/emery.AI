/**
 * Role DTOs - Single source of truth for role data transfer
 * Used by: Server Actions, Application Services, Client Components
 *
 * AIDEV-NOTE: Consolidated role DTOs for multi-role system
 * Following the pattern established in team.dto.ts
 */

// Re-export full RoleDTO from permission-mapper for backwards compatibility
export type { RoleDTO } from '@/app/mappers/permission-mapper';

/**
 * Minimal role DTO for member lists and UI display
 * Use this when you only need id, name, and isSystem flag
 */
export interface RoleBasicDTO {
  id: number;
  name: string;
  isSystem: boolean;
}

/**
 * Role DTO for selection dropdowns (EntityMultiSelect, etc.)
 */
export interface RoleSelectionDTO {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
}

/**
 * Helper type guard to check if a role is a basic DTO
 */
export function isRoleBasicDTO(role: unknown): role is RoleBasicDTO {
  return (
    typeof role === 'object' &&
    role !== null &&
    'id' in role &&
    'name' in role &&
    'isSystem' in role &&
    typeof (role as RoleBasicDTO).id === 'number' &&
    typeof (role as RoleBasicDTO).name === 'string' &&
    typeof (role as RoleBasicDTO).isSystem === 'boolean'
  );
}
