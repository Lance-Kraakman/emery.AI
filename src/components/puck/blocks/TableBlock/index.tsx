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
import { getDataSource, executeDataSource } from "@/app/actions/data-sources";

export const TableBlockConfig: ComponentConfig<TableBlockProps> = {
  label: "Table",

  fields: {
    // Data Source Selection
    dataSourceId: {
      label: "Data Source",
      type: "number",
    },
    dataSourceName: {
      label: "Data Source Name",
      type: "text",
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
   * The TableBlock render component receives pre-resolved plain data.
   */
  resolveData: async ({ props }, { metadata }) => {
    try {
      // If no data source selected, return props as-is
      if (!props.dataSourceId) {
        return { props };
      }

      // Get data source details (Server Action - RPC to server if on client)
      const dataSource = await getDataSource(props.dataSourceId);

      if (!dataSource) {
        return {
          props: {
            ...props,
            _rows: [],
            _fields: [],
            _totalCount: 0,
          } as any,
        };
      }

      // Execute data source to get rows (Server Action - returns DTOs)
      const result = await executeDataSource(props.dataSourceId);

      if (!result) {
        return {
          props: {
            ...props,
            dataSourceName: dataSource.name,
            _rows: [],
            _fields: [],
            _totalCount: 0,
          } as any,
        };
      }

      // Auto-generate field mappings if none exist
      let fieldMappings = props.fieldMappings || [];
      if (fieldMappings.length === 0 && result.fields.length > 0) {
        // Note: result.fields are now plain objects with { id, name, type, slug }
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
          dataSourceName: dataSource.name,
          fieldMappings,
          _rows: result.rows,        // Plain objects from .toPlainObject()
          _fields: result.fields,    // Plain objects: { id, name, type, slug }
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
