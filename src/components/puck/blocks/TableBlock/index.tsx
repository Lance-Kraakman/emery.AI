/**
 * TableBlock - Puck Component Configuration
 *
 * AIDEV-NOTE: This is the Puck config for TableBlock.
 * The resolveData hook executes server-side to fetch data from the selected
 * data source, applying filters/sorting/pagination before rendering.
 *
 * Flow:
 * 1. User selects data source in Puck editor (via DataSourceField)
 * 2. User configures field mappings (via FieldMappingField)
 * 3. resolveData executes on server, fetches rows
 * 4. TableBlock component receives pre-resolved data as props
 */

/**
 * TableBlock - Puck Component Configuration
 *
 * AIDEV-NOTE: This is the Puck config for TableBlock.
 * Uses Server Actions to fetch data, avoiding client bundle pollution.
 * Server Actions ('use server') create an RPC boundary that prevents
 * DIContainer, gRPC clients, and Node.js built-ins from bundling into client.
 *
 * Flow:
 * 1. User selects data source in Puck editor (via DataSourceField)
 * 2. User configures field mappings (via FieldMappingField)
 * 3. resolveData executes (server or client context)
 * 4. Server Actions called → RPC to server if needed
 * 5. TableBlock component receives pre-resolved DTO data as props
 */

import type { ComponentConfig } from "@measured/puck";
import TableBlock, { type TableBlockProps } from "./TableBlock";
import { getDataSource, executeDataSource, getDataSourcesForTable, createDataSource } from "@/app/actions/data-sources";
import { getTables } from "@/app/actions/tables";

export const TableBlockConfig: ComponentConfig<TableBlockProps> = {
  label: "Table",

  fields: {
    // Table Selection (auto-creates default data source)
    table: {
      label: "Table",
      type: "external",
      placeholder: "Select a table",
      showSearch: true,
      fetchList: async ({ query }: { query: string }) => {
        const tables = await getTables();
        const filteredTables = query
          ? tables.filter((t) =>
              t.name.toLowerCase().includes(query.toLowerCase())
            )
          : tables;
        return filteredTables.map((t) => ({
          id: t.id,
          name: t.name,
          databaseId: t.databaseId,
          title: t.name,
          description: t.description || `Database ID: ${t.databaseId}`,
        }));
      },
      mapProp: (item: any) => ({
        id: item.id,
        name: item.name,
        databaseId: item.databaseId,
      }),
      getItemSummary: (item: any) => item?.name || "No table selected",
    } as any,

    // Optional: Custom data source override (filtered by selected table)
    dataSourceOverride: {
      label: "Custom View (Optional)",
      type: "external",
      placeholder: "Use default view",
      showSearch: true,
      fetchList: async ({ query }: { query: string }, { props }: any) => {
        // Only show data sources if a table is selected
        if (!props?.table?.id) {
          return [];
        }

        const dataSources = await getDataSourcesForTable(props.table.id);
        const filteredSources = query
          ? dataSources.filter((ds: any) =>
              ds.name.toLowerCase().includes(query.toLowerCase())
            )
          : dataSources;

        return filteredSources.map((ds: any) => ({
          id: ds.id,
          name: ds.name,
          tableId: ds.tableId,
          title: ds.name,
          description: `${ds.filters.length} filters, ${ds.sorting.length} sorts`,
        }));
      },
      mapProp: (item: any) => (item ? {
        id: item.id,
        name: item.name,
        tableId: item.tableId,
      } : null),
      getItemSummary: (item: any) => item?.name || "Using default view",
    } as any,

    // Hidden fields populated by resolveData
    dataSourceId: {
      label: "Data Source ID",
      type: "number",
      visible: false,
    },
    dataSourceName: {
      label: "Data Source Name",
      type: "text",
      visible: false,
    },

    // Field Mappings
    fieldMappings: {
      label: "Column Configuration",
      type: "array",
      min: 0,
      getItemSummary: (item: any) => {
        return item?.visible
          ? `${item.order + 1}. ${item.displayName}`
          : `${item.displayName} (hidden)`;
      },
      arrayFields: {
        sourceFieldId: {
          type: "number",
          label: "Field ID",
        },
        displayName: {
          type: "text",
          label: "Display Name",
        },
        visible: {
          type: "radio",
          label: "Visible",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        order: {
          type: "number",
          label: "Order",
          min: 0,
        },
      },
      defaultItemProps: {
        sourceFieldId: 0,
        displayName: "Column",
        visible: true,
        order: 0,
      },
    },

    // Display Options
    showHeader: {
      label: "Show Table Header",
      type: "radio",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    striped: {
      label: "Striped Rows",
      type: "radio",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    bordered: {
      label: "Bordered Cells",
      type: "radio",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    compact: {
      label: "Compact Layout",
      type: "radio",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
  },

  defaultProps: {
    showHeader: true,
    striped: true,
    bordered: false,
    compact: false,
    fieldMappings: [],
  },

  /**
   * Server-side data resolution
   *
   * AIDEV-NOTE: This executes in multiple contexts (server render, Puck editor).
   * Uses Server Actions which create an RPC boundary when called from client.
   * All data is returned as DTOs (plain objects), not domain entities.
   *
   * Hybrid Flow (Either/Or Approach):
   * 1. User selects table from dropdown
   * 2. If user selected a custom data source override → use it
   * 3. Otherwise, check if default data source exists for that table
   * 4. If not, auto-create one with name "Default view of {tableName}"
   * 5. Execute data source and return rows
   */
  resolveData: async ({ props }, { metadata }) => {
    try {
      // If no table selected, return props as-is
      if (!props.table?.id) {
        return { props };
      }

      const tableId = props.table.id;
      const tableName = props.table.name;

      let dataSourceId: number;
      let dataSourceName: string;

      // Check if user selected a custom data source override
      if (props.dataSourceOverride?.id) {
        // Use the custom data source selected by user
        dataSourceId = props.dataSourceOverride.id;
        dataSourceName = props.dataSourceOverride.name;
      } else {
        // Auto-create or use default data source for the table
        const existingDataSources = await getDataSourcesForTable(tableId);

        if (existingDataSources.length > 0) {
          // Use the first existing data source
          dataSourceId = existingDataSources[0].id;
          dataSourceName = existingDataSources[0].name;
        } else {
          // Auto-create a default data source
          const createResult = await createDataSource({
            tableId,
            name: `Default view of ${tableName}`,
            description: "Auto-created default data source for table",
          });

          if (!createResult.success || !createResult.data) {
            return {
              props: {
                ...props,
                _rows: [],
                _fields: [],
                _totalCount: 0,
              } as any,
            };
          }

          dataSourceId = createResult.data.id;
          dataSourceName = createResult.data.name;
        }
      }

      // Execute data source to get rows (Server Action - returns DTOs)
      const result = await executeDataSource(dataSourceId);

      if (!result) {
        return {
          props: {
            ...props,
            dataSourceId,
            dataSourceName,
            _rows: [],
            _fields: [],
            _totalCount: 0,
          } as any,
        };
      }

      // Auto-generate field mappings if none exist
      let fieldMappings = props.fieldMappings || [];
      if (fieldMappings.length === 0 && result.fields.length > 0) {
        // Note: result.fields are now plain objects with { id, name, type }
        fieldMappings = result.fields.slice(0, 10).map((field, index) => ({
          sourceFieldId: field.id, // Plain number, not field.id.value
          displayName: field.name,
          visible: true,
          order: index,
        }));
      }

      // Return props with resolved DTO data
      return {
        props: {
          ...props,
          dataSourceId,
          dataSourceName,
          fieldMappings,
          _rows: result.rows,        // Plain objects from .toPlainObject()
          _fields: result.fields,    // Plain objects: { id, name, type }
          _totalCount: result.totalCount,
        } as any,
      };
    } catch (error) {
      console.error("Error in TableBlock resolveData:", error);

      // Return safe fallback on error
      return {
        props: {
          ...props,
          _rows: [],
          _fields: [],
          _totalCount: 0,
        } as any,
      };
    }
  },

  render: (props) => {
    return <TableBlock {...(props as any)} />;
  },
};

export default TableBlockConfig;
