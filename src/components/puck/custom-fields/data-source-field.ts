/**
 * DataSourceField - Custom Puck field for selecting data sources
 *
 * AIDEV-NOTE: This is a field configuration object (not a React component).
 * It uses Puck's "external" field type to fetch and display available data sources.
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
import { getDataSourcesForOrganization } from "@/lib/puck/data-source-helpers";

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
      // Fetch data sources for the organization
      const dataSources = await getDataSourcesForOrganization(params.organizationId);

      // Filter by search query
      const filteredSources = query
        ? dataSources.filter((ds) =>
            ds.name.toLowerCase().includes(query.toLowerCase())
          )
        : dataSources;

      // Map to external field format
      return filteredSources.map((ds) => ({
        id: ds.id.value,
        name: ds.name,
        tableId: ds.tableId.value,
        title: ds.name,
        description: `Table ID: ${ds.tableId.value}`,
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
      // Fetch all data sources for the organization
      const allDataSources = await getDataSourcesForOrganization(params.organizationId);

      // Filter by table ID
      const tableSources = allDataSources.filter(
        (ds) => ds.tableId.value === params.tableId
      );

      // Further filter by search query
      const filteredSources = query
        ? tableSources.filter((ds) =>
            ds.name.toLowerCase().includes(query.toLowerCase())
          )
        : tableSources;

      return filteredSources.map((ds) => ({
        id: ds.id.value,
        name: ds.name,
        tableId: ds.tableId.value,
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
