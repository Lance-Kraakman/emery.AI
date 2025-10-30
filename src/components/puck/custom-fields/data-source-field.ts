/**
 * DataSourceField - Custom Puck field for selecting data sources
 *
 * AIDEV-NOTE: This is a field configuration object (not a React component).
 * Uses Server Actions to fetch data sources. Server Actions ('use server')
 * prevent bundling server-only code (DIContainer, gRPC) into client bundle.
 *
 * Usage in a Puck component:
 * ```typescript
 * import { createDataSourceField } from './custom-fields/data-source-field';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     dataSource: createDataSourceField({ organizationId: 1 })
 *   }
 * }
 * ```
 */

import { ExternalField } from "@measured/puck";
import { getDataSourcesForOrganization } from "@/app/actions/data-sources";

export interface DataSourceFieldValue {
  id: number;
  name: string;
  tableId: number;
}

/**
 * Create a data source selection field
 *
 * This field allows users to select from available data sources in their organization.
 */
export function createDataSourceField(params: {
  organizationId: number;
  placeholder?: string;
}): ExternalField<DataSourceFieldValue> {
  return {
    type: "external",
    placeholder: params.placeholder || "Select a data source",
    showSearch: true,

    fetchList: async ({ query }) => {
      // Fetch data sources for the organization (Server Action - returns DTOs)
      const dataSources = await getDataSourcesForOrganization();

      // Filter by search query
      const filteredSources = query
        ? dataSources.filter((ds) =>
            ds.name.toLowerCase().includes(query.toLowerCase())
          )
        : dataSources;

      // Map to external field format
      // AIDEV-NOTE: dataSources are now DTOs (plain objects), not domain entities
      return filteredSources.map((ds) => ({
        id: ds.id,        // Plain number, not ds.id.value
        name: ds.name,
        tableId: ds.tableId,  // Plain number, not ds.tableId.value
        title: ds.name,
        description: `Table ID: ${ds.tableId}`,
      }));
    },

    mapProp: (item) => ({
      id: item.id,
      name: item.name,
      tableId: item.tableId,
    }),

    getItemSummary: (item) => item?.name || "No data source selected",
  };
}

/**
 * Create a data source field that filters by table
 *
 * Useful when you want to select a data source for a specific table.
 */
export function createDataSourceFieldForTable(params: {
  tableId: number;
  organizationId: number;
  placeholder?: string;
}): ExternalField<DataSourceFieldValue> {
  return {
    type: "external",
    placeholder: params.placeholder || "Select a data source",
    showSearch: true,

    fetchList: async ({ query }) => {
      // Fetch all data sources for the organization (Server Action - returns DTOs)
      const allDataSources = await getDataSourcesForOrganization();

      // Filter by table ID
      // AIDEV-NOTE: DTOs have plain tableId property, not ds.tableId.value
      const tableSources = allDataSources.filter(
        (ds) => ds.tableId === params.tableId
      );

      // Further filter by search query
      const filteredSources = query
        ? tableSources.filter((ds) =>
            ds.name.toLowerCase().includes(query.toLowerCase())
          )
        : tableSources;

      return filteredSources.map((ds) => ({
        id: ds.id,        // Plain number
        name: ds.name,
        tableId: ds.tableId,  // Plain number
        title: ds.name,
        description: `${ds.filters.length} filters, ${ds.sorting.length} sorts`,
      }));
    },

    mapProp: (item) => ({
      id: item.id,
      name: item.name,
      tableId: item.tableId,
    }),

    getItemSummary: (item) => item?.name || "No data source selected",
  };
}
