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
import { getView, executeView, getViewsForTable, createView } from "@/app/actions/views";
import { getTables } from "@/app/actions/tables";
import { getFields } from "@/app/actions/fields";

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
      mapProp: (item: any) => (item ? {
        id: item.id,
        name: item.name,
        databaseId: item.databaseId,
      } : null),
      getItemSummary: (item: any) => item?.name || "No table selected",
    } as any,

    // Optional: Custom view override (filtered by selected table)
    // AIDEV-NOTE: Views represent filtered/sorted configurations of a table.
    // If not specified, a default view will be auto-created for the selected table.
    dataSourceOverride: {
      label: "View (Optional)",
      type: "external",
      placeholder: "Use default view",
      showSearch: true,
      fetchList: async ({ query }: { query: string }, context: any) => {
        console.log('[dataSourceOverride fetchList] Called with:', {
          query,
          contextKeys: Object.keys(context || {}),
          props: context?.props,
          tableId: context?.props?.table?.id
        });

        // Only show data sources if a table is selected
        if (!context?.props?.table?.id) {
          console.log('[dataSourceOverride fetchList] No table ID in context, returning empty');
          return [];
        }

        const tableId = context.props.table.id;
        console.log('[dataSourceOverride fetchList] Fetching data sources for table:', tableId);

        const dataSources = await getViewsForTable(tableId);
        console.log('[dataSourceOverride fetchList] Found data sources:', dataSources.length);

        const filteredSources = query
          ? dataSources.filter((ds: any) =>
              ds.name.toLowerCase().includes(query.toLowerCase())
            )
          : dataSources;

        const result = filteredSources.map((ds: any) => ({
          id: ds.id,
          name: ds.name,
          tableId: ds.tableId,
          title: ds.name,
          description: `${ds.filters.length} filters, ${ds.sorting.length} sorts`,
        }));

        console.log('[dataSourceOverride fetchList] Returning options:', result.length);
        return result;
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

    // Helper field to show available fields (populated by resolveData)
    _availableFieldsInfo: {
      label: "Available Fields (Reference Only)",
      type: "textarea",
    },

    // Field Mappings
    // AIDEV-NOTE: Column configuration controls which fields are displayed and in what order.
    // If left empty, the first 10 fields will be auto-generated in resolveData.
    // Users typically don't need to configure this manually - auto-generation works for most cases.
    // To customize: After selecting a table, the columns will auto-populate. You can then:
    // - Reorder by changing the "order" value
    // - Rename by changing "Display Name"
    // - Hide by changing "Visible" to "Hide"
    fieldMappings: {
      label: "Column Configuration (Auto-configured)",
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
          label: "Field ID (auto-filled)",
          min: 1,
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
      console.log('[TableBlock resolveData] Starting with props:', {
        tableId: props.table?.id,
        tableName: props.table?.name,
        hasDataSourceOverride: !!props.dataSourceOverride
      });

      // If no table selected, return props as-is
      if (!props.table?.id) {
        console.log('[TableBlock resolveData] No table selected, returning empty');
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
        console.log('[TableBlock resolveData] Using custom data source override:', { dataSourceId, dataSourceName });
      } else {
        // Auto-create or use default data source for the table
        console.log('[TableBlock resolveData] Fetching existing data sources for table:', tableId);
        const existingDataSources = await getViewsForTable(tableId);
        console.log('[TableBlock resolveData] Found existing data sources:', existingDataSources.length);

        if (existingDataSources.length > 0) {
          // Use the first existing data source
          dataSourceId = existingDataSources[0].id;
          dataSourceName = existingDataSources[0].name;
          console.log('[TableBlock resolveData] Using existing data source:', { dataSourceId, dataSourceName });
        } else {
          // Auto-create a default data source
          console.log('[TableBlock resolveData] Auto-creating default data source for table:', tableName);
          const createResult = await createView({
            tableId,
            name: `Default view of ${tableName}`,
            description: "Auto-created default data source for table",
          });

          if (!createResult.success || !createResult.data) {
            console.error('[TableBlock resolveData] Failed to create data source:', createResult.error);
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
          console.log('[TableBlock resolveData] Created data source:', { dataSourceId, dataSourceName });
        }
      }

      // Execute data source to get rows (Server Action - returns DTOs)
      console.log('[TableBlock resolveData] Executing data source:', dataSourceId);
      const result = await executeView(dataSourceId);

      if (!result) {
        console.error('[TableBlock resolveData] executeView returned null');
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

      console.log('[TableBlock resolveData] Got result:', {
        rowCount: result.rows.length,
        fieldCount: result.fields.length,
        totalCount: result.totalCount,
        sampleRow: result.rows[0],
        sampleField: result.fields[0]
      });

      // Auto-generate field mappings if none exist
      let fieldMappings = props.fieldMappings || [];
      if (fieldMappings.length === 0 && result.fields.length > 0) {
        console.log('[TableBlock resolveData] Auto-generating field mappings for', result.fields.length, 'fields');
        // Note: result.fields are now plain objects with { id, name, type }
        fieldMappings = result.fields.slice(0, 10).map((field, index) => ({
          sourceFieldId: field.id, // Plain number, not field.id.value
          displayName: field.name,
          visible: true,
          order: index,
        }));
        console.log('[TableBlock resolveData] Generated mappings:', fieldMappings);
      } else {
        console.log('[TableBlock resolveData] Using existing field mappings:', fieldMappings.length);
      }

      // Generate available fields info for user reference
      const availableFieldsInfo = result.fields.length > 0
        ? `Available Fields:\n${result.fields.map(f => `  ID ${f.id}: ${f.name} (${f.type})`).join('\n')}\n\nℹ️ Columns are auto-configured. To customize, edit the items above.`
        : 'No fields available';

      // Return props with resolved DTO data
      console.log('[TableBlock resolveData] Returning resolved data:', {
        dataSourceId,
        dataSourceName,
        rowCount: result.rows.length,
        fieldCount: result.fields.length,
        mappingCount: fieldMappings.length
      });

      return {
        props: {
          ...props,
          dataSourceId,
          dataSourceName,
          fieldMappings,
          _availableFieldsInfo: availableFieldsInfo,
          _rows: result.rows,        // Plain objects from .toPlainObject()
          _fields: result.fields,    // Plain objects: { id, name, type }
          _totalCount: result.totalCount,
        } as any,
      };
    } catch (error) {
      console.error("[TableBlock resolveData] Fatal error:", error);
      console.error("[TableBlock resolveData] Error stack:", error instanceof Error ? error.stack : 'No stack');

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
