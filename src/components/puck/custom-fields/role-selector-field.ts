/**
 * RoleSelectorField - Custom Puck field for selecting roles
 *
 * AIDEV-NOTE: This is a field configuration object (not a React component).
 * Uses Server Actions to fetch organization roles. Server Actions ('use server')
 * prevent bundling server-only code (DIContainer, gRPC) into client bundle.
 *
 * Usage in a Puck component:
 * ```typescript
 * import { createRoleSelectorField } from './custom-fields/role-selector-field';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     defaultRole: createRoleSelectorField()
 *   }
 * }
 * ```
 */

import { ExternalField } from "@measured/puck";
import { getOrganizationRolesForSelection } from "@/app/actions/roles";

export interface RoleSelectorFieldValue {
  id: number;
  name: string;
}

/**
 * Create a role selection field for sign-up default role
 *
 * This field allows users to select from available roles in their organization
 * to be assigned as the default role for new sign-ups.
 */
export function createRoleSelectorField(params?: {
  placeholder?: string;
}): ExternalField<RoleSelectorFieldValue | null> {
  return {
    type: "external",
    placeholder: params?.placeholder || "Select a default role (optional)",
    showSearch: true,

    fetchList: async ({ query }) => {
      // Fetch roles for the organization (Server Action - returns DTOs)
      const roles = await getOrganizationRolesForSelection();

      // Filter by search query
      const filteredRoles = query
        ? roles.filter((r) =>
            r.name.toLowerCase().includes(query.toLowerCase())
          )
        : roles;

      // Map to external field format
      return filteredRoles.map((r) => ({
        id: r.id,
        name: r.name,
        title: r.name,
        description: r.description || (r.isSystem ? "System role" : "Custom role"),
      }));
    },

    mapProp: (item) => (item ? { id: item.id, name: item.name } : null),

    getItemSummary: (item) => item?.name || "No role selected",
  };
}
