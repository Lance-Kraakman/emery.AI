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

import type { ComponentConfig } from "@measured/puck";
import TableBlock, { type TableBlockProps } from "./TableBlock";
import { createDataSourceField } from "../../custom-fields/data-source-field";
import { createFieldMappingField } from "../../custom-fields/field-mapping-field";
import { getDataSource, executeDataSource } from "@/lib/puck/data-source-helpers";
import { getTableFromMetadata } from "@/lib/puck/resolve-table-metadata";
import { createDebugLogger } from "@/lib/utils/debug-logger";

const logger = createDebugLogger("TableBlock");

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
   * AIDEV-NOTE: This executes on the server during page rendering.
   * It fetches the actual row data from the selected data source
   * and injects it into props as _rows, _fields, _totalCount.
   *
   * The TableBlock render component then uses this pre-resolved data.
   */
  resolveData: async ({ props }, { metadata }) => {
    try {
      logger.debug("TableBlock resolveData called", {
        dataSourceId: props.dataSourceId,
        hasMetadata: !!metadata,
      });

      // If no data source selected, return props as-is
      if (!props.dataSourceId) {
        logger.debug("No data source selected, skipping data resolution");
        return { props };
      }

      // Get data source details
      const dataSource = await getDataSource(props.dataSourceId);

      if (!dataSource) {
        logger.debug("Data source not found", { dataSourceId: props.dataSourceId });
        return {
          props: {
            ...props,
            _rows: [],
            _fields: [],
            _totalCount: 0,
          } as any,
        };
      }

      // Execute data source to get rows
      const result = await executeDataSource(props.dataSourceId);

      if (!result) {
        logger.debug("Failed to execute data source", { dataSourceId: props.dataSourceId });
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
        logger.debug("Auto-generating field mappings", { fieldCount: result.fields.length });
        fieldMappings = result.fields.slice(0, 10).map((field, index) => ({
          sourceFieldId: field.id.value,
          displayName: field.name,
          visible: true,
          order: index,
        }));
      }

      logger.debug("TableBlock data resolved", {
        rowCount: result.rows.length,
        totalCount: result.totalCount,
        fieldCount: result.fields.length,
      });

      // Return props with resolved data
      return {
        props: {
          ...props,
          dataSourceName: dataSource.name,
          fieldMappings,
          _rows: result.rows,
          _fields: result.fields,
          _totalCount: result.totalCount,
        } as any,
      };
    } catch (error) {
      logger.error("Error in TableBlock resolveData", error);

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
