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
import { getView, executeView, getViewsForOrganization } from "@/app/actions/views";
import { getTables } from "@/app/actions/tables";

export const TableBlockConfig: ComponentConfig<TableBlockProps> = {
  label: "Table",

  fields: {
    // View Selection - Single required field showing "ViewName (TableName)"
    // AIDEV-NOTE: Simplified from table+view to just view selection.
    // Users select a view, which automatically determines the table.
    viewId: {
      label: "View",
      type: "external",
      placeholder: "Select a view",
      showSearch: true,
      fetchList: async ({ query }: { query: string }) => {
        console.log('[viewId fetchList] Fetching all views for organization');

        // Get all views and tables to build "ViewName (TableName)" format
        const [views, tables] = await Promise.all([
          getViewsForOrganization(),
          getTables()
        ]);

        console.log('[viewId fetchList] Found views:', views.length, 'tables:', tables.length);

        // Create a table lookup map
        const tableMap = new Map(tables.map(t => [t.id, t.name]));

        // Filter by query if provided
        const filteredViews = query
          ? views.filter((v) =>
              v.name.toLowerCase().includes(query.toLowerCase()) ||
              tableMap.get(v.tableId)?.toLowerCase().includes(query.toLowerCase())
            )
          : views;

        const result = filteredViews.map((v) => ({
          id: v.id,
          name: v.name,
          tableId: v.tableId,
          tableName: tableMap.get(v.tableId) || `Table ${v.tableId}`,
          title: `${v.name}`,
          description: `Table: ${tableMap.get(v.tableId) || v.tableId} | ${v.filters.length} filters, ${v.sorting.length} sorts`,
        }));

        console.log('[viewId fetchList] Returning options:', result.length);
        return result;
      },
      mapProp: (item: any) => item?.id || null,
      getItemSummary: (item: any, context: any) => {
        // item is the viewId (number)
        // Try to get view name from context if available
        const viewId = typeof item === 'number' ? item : item?.id;
        const viewName = context?.props?._viewName;
        const tableName = context?.props?._tableName;

        if (viewName && tableName) {
          return `${viewName} (${tableName})`;
        } else if (viewName) {
          return viewName;
        } else if (viewId) {
          return `View ID: ${viewId}`;
        }
        return "No view selected";
      },
    } as any,

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
        // The 'id' field is special - it's stored as `row.id` not `row.field_X` in toViewFormat()
        // See src/ddd/domain/tables/value-objects/row.ts:162-164

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
          _rows: result.rows,        // Plain objects from .toViewFormat()
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
