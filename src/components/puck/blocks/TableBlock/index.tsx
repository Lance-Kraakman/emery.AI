/**
 * TableBlock - Puck Component Configuration
 *
 * AIDEV-NOTE: This is the Puck config for TableBlock.
 * Column configuration is now stored in the View (database), following Baserow's architecture.
 * Users manage column visibility, order, and display names through the Views UI.
 *
 * Flow:
 * 1. User selects a view in Puck editor
 * 2. resolveData executes on server, fetches view details
 * 3. Uses view's field mappings (or auto-generates if none exist)
 * 4. Executes view to get filtered/sorted/paginated data
 * 5. TableBlock component receives pre-resolved DTO data as props
 */

import type { ComponentConfig } from "@measured/puck";
import TableBlock, { type TableBlockProps } from "./TableBlock";
import { getView, executeView } from "@/app/actions/views";
import { getTables } from "@/app/actions/tables";
import { createViewManagementField } from "../../custom-fields";

export const TableBlockConfig: ComponentConfig<TableBlockProps> = {
  label: "Table",

  fields: {
    // View Selection - Inline creation and editing support
    // AIDEV-NOTE: Using custom view management field for inline view creation.
    // Users can create/edit grid views directly from the Puck sidebar.
    viewId: createViewManagementField({
      supportedViewTypes: ['grid'],
      label: 'Grid View',
    }),

    // Hidden fields populated by resolveData
    _viewName: {
      label: "View Name",
      type: "text",
      visible: false,
    },
    _tableName: {
      label: "Table Name",
      type: "text",
      visible: false,
    },
    _tableId: {
      label: "Table ID",
      type: "number",
      visible: false,
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
  },

  /**
   * Server-side data resolution
   *
   * AIDEV-NOTE: Uses view-based field mappings following Baserow's architecture.
   * User selects a view (required), which determines the table automatically.
   * View contains filters, sorting, pagination, AND field mappings (column config).
   * Field mappings control column visibility, order, and display names.
   */
  resolveData: async ({ props }, { metadata }) => {
    try {
      console.log('[TableBlock resolveData] Starting with props:', {
        viewId: props.viewId
      });

      // If no view selected, return props as-is
      if (!props.viewId) {
        console.log('[TableBlock resolveData] No view selected, returning empty');
        return { props };
      }

      const viewId = props.viewId;

      // Get view details to populate view name and table name for display
      const view = await getView(viewId);
      if (!view) {
        console.error('[TableBlock resolveData] Failed to get view details for viewId:', viewId);
        return {
          props: {
            ...props,
            _rows: [],
            _fields: [],
            _totalCount: 0,
          } as any,
        };
      }

      // Get table name for display
      const tables = await getTables();
      const table = tables.find(t => t.id === view.tableId);
      const tableName = table?.name || `Table ${view.tableId}`;

      // Execute view to get rows (Server Action - returns DTOs)
      console.log('[TableBlock resolveData] Executing view:', viewId);
      const result = await executeView(viewId);

      if (!result) {
        console.error('[TableBlock resolveData] executeView returned null');
        return {
          props: {
            ...props,
            _viewName: view.name,
            _tableName: tableName,
            _tableId: view.tableId,
            _rows: [],
            _fields: [],
            _totalCount: 0,
          } as any,
        };
      }

      console.log('[TableBlock resolveData] Got result:', {
        viewId,
        viewName: view.name,
        tableName,
        rowCount: result.rows.length,
        fieldCount: result.fields.length,
        totalCount: result.totalCount,
        sampleRow: result.rows[0],
        sampleField: result.fields[0]
      });

      // Use field mappings from view, auto-generate only if view has none
      // AIDEV-NOTE: Field mappings are now stored in the view (database), not component props.
      // This follows Baserow's architecture where views control column visibility/order.
      let fieldMappings = view.fieldMappings || [];

      if (fieldMappings.length === 0 && result.fields.length > 0) {
        console.log('[TableBlock resolveData] View has no field mappings, auto-generating for', result.fields.length, 'fields');

        // AIDEV-NOTE: Include 'id' field but hidden by default
        // The 'id' field is special - it's always present in row.toPlainObject()
        // See src/ddd/domain/tables/value-objects/row.ts

        fieldMappings = result.fields.map((field, index) => {
          const isIdField = field.name === 'id';

          return {
            sourceFieldId: field.id, // Plain number
            displayName: field.name,
            visible: !isIdField, // Hide 'id' field by default
            order: index,
          };
        }).slice(0, 10); // Take first 10 fields

        console.log('[TableBlock resolveData] Generated mappings (id field hidden):', fieldMappings.length);
      } else {
        console.log('[TableBlock resolveData] Using view field mappings:', fieldMappings.length);
      }

      // Return props with resolved DTO data
      console.log('[TableBlock resolveData] Returning resolved data:', {
        viewId,
        viewName: view.name,
        tableName,
        tableId: view.tableId,
        rowCount: result.rows.length,
        fieldCount: result.fields.length,
        mappingCount: fieldMappings.length
      });

      return {
        props: {
          ...props,
          _viewName: view.name,
          _tableName: tableName,
          _tableId: view.tableId,
          fieldMappings,            // From view, not component props
          _rows: result.rows,        // Plain objects from row.toPlainObject()
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
