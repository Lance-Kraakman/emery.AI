/**
 * TableField - Custom Puck field for selecting tables
 *
 * AIDEV-NOTE: This is a field configuration object (not a React component).
 * Uses Server Actions to fetch tables. Server Actions ('use server')
 * prevent bundling server-only code (DIContainer, gRPC) into client bundle.
 *
 * Usage in a Puck component:
 * ```typescript
 * import { createTableField } from './custom-fields/table-field';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     table: createTableField({ organizationId: 1 })
 *   }
 * }
 * ```
 */

import { ExternalField } from "@measured/puck";
import { getTables } from "@/app/actions/tables";

export interface TableFieldValue {
  id: number;
  name: string;
  databaseId: number;
}

/**
 * Create a table selection field
 *
 * This field allows users to select from available tables in their organization.
 */
export function createTableField(params: {
  organizationId: number;
  placeholder?: string;
}): ExternalField<TableFieldValue> {
  return {
    type: "external",
    placeholder: params.placeholder || "Select a table",
    showSearch: true,

    fetchList: async ({ query }) => {
      // Fetch tables for the organization (Server Action - returns DTOs)
      const tables = await getTables();

      // Filter by search query
      const filteredTables = query
        ? tables.filter((table) =>
            table.name.toLowerCase().includes(query.toLowerCase())
          )
        : tables;

      // Map to external field format
      // AIDEV-NOTE: tables are now DTOs (plain objects), not domain entities
      return filteredTables.map((table) => ({
        id: table.id,           // Plain number, not table.id.value
        name: table.name,
        databaseId: table.databaseId,  // Plain number
        title: table.name,
        description: table.description || `Database ID: ${table.databaseId}`,
      }));
    },

    mapProp: (item) => ({
      id: item.id,
      name: item.name,
      databaseId: item.databaseId,
    }),

    getItemSummary: (item) => item?.name || "No table selected",
  };
}

/**
 * Create a table field that filters by database
 *
 * Useful when you want to select a table for a specific database.
 */
export function createTableFieldForDatabase(params: {
  databaseId: number;
  organizationId: number;
  placeholder?: string;
}): ExternalField<TableFieldValue> {
  return {
    type: "external",
    placeholder: params.placeholder || "Select a table",
    showSearch: true,

    fetchList: async ({ query }) => {
      // Fetch all tables for the organization (Server Action - returns DTOs)
      const allTables = await getTables();

      // Filter by database ID
      // AIDEV-NOTE: DTOs have plain databaseId property, not table.databaseId.value
      const databaseTables = allTables.filter(
        (table) => table.databaseId === params.databaseId
      );

      // Further filter by search query
      const filteredTables = query
        ? databaseTables.filter((table) =>
            table.name.toLowerCase().includes(query.toLowerCase())
          )
        : databaseTables;

      return filteredTables.map((table) => ({
        id: table.id,           // Plain number
        name: table.name,
        databaseId: table.databaseId,  // Plain number
        title: table.name,
        description: table.description || `${allTables.length} tables in database`,
      }));
    },

    mapProp: (item) => ({
      id: item.id,
      name: item.name,
      databaseId: item.databaseId,
    }),

    getItemSummary: (item) => item?.name || "No table selected",
  };
}
