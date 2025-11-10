/**
 * FormBlock - Puck Component Configuration
 *
 * AIDEV-NOTE: This is the Puck config for FormBlock.
 * Allows users to select a form view and automatically fetches configuration.
 *
 * Flow:
 * 1. User selects a form view in Puck editor
 * 2. resolveData executes on server, fetches form view configuration
 * 3. FormBlock component receives pre-resolved data as props
 */

import type { ComponentConfig } from "@measured/puck";
import FormBlock, { type FormBlockProps } from "./FormBlock";
import { getFormViewConfiguration, getViewsForOrganization } from "@/app/actions/views";
import { getTables } from "@/app/actions/tables";

export const FormBlockConfig: ComponentConfig<FormBlockProps> = {
  label: "Form",

  fields: {
    // View Selection - Single required field showing "ViewName (TableName)"
    viewId: {
      label: "Form View",
      type: "external",
      placeholder: "Select a form view",
      showSearch: true,
      fetchList: async ({ query }: { query: string }) => {
        console.log('[FormBlock.viewId fetchList] Fetching all views for organization');

        // Get all views and tables
        const [views, tables] = await Promise.all([
          getViewsForOrganization(),
          getTables()
        ]);

        console.log('[FormBlock.viewId fetchList] Found views:', views.length, 'tables:', tables.length);

        // Filter to only form views
        // AIDEV-NOTE: ViewMapper ensures viewType is always a string in DTOs
        const formViews = views.filter(v => v.viewType === 'form');

        console.log('[FormBlock.viewId fetchList] Found form views:', formViews.length);

        // Create a table lookup map
        const tableMap = new Map(tables.map(t => [t.id, t.name]));

        // Filter by query if provided
        const filteredViews = query
          ? formViews.filter((v) =>
              v.name.toLowerCase().includes(query.toLowerCase()) ||
              tableMap.get(v.tableId)?.toLowerCase().includes(query.toLowerCase())
            )
          : formViews;

        const result = filteredViews.map((v) => ({
          id: v.id,
          name: v.name,
          tableId: v.tableId,
          tableName: tableMap.get(v.tableId) || `Table ${v.tableId}`,
          title: `${v.name}`,
          description: `Table: ${tableMap.get(v.tableId) || v.tableId}`,
        }));

        console.log('[FormBlock.viewId fetchList] Returning options:', result.length);
        return result;
      },
      mapProp: (item: any) => item?.id || null,
      getItemSummary: (item: any, context: any) => {
        // item is the viewId (number)
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
        return "No form view selected";
      },
    },
  },

  /**
   * Resolve data on the server
   *
   * AIDEV-NOTE: This executes on the server during SSR/SSG.
   * Fetches form view configuration so the client component receives complete data.
   */
  resolveData: async ({ props }) => {
    console.log('[FormBlock.resolveData] Starting resolution for view:', props.viewId);

    if (!props.viewId) {
      console.log('[FormBlock.resolveData] No viewId provided');
      return {
        props: {
          ...props,
          _viewName: undefined,
          _viewDescription: undefined,
          _formConfig: undefined,
          _tableFields: undefined,
          _tableId: undefined,
        },
      };
    }

    try {
      // Fetch form view configuration
      const formViewData = await getFormViewConfiguration(props.viewId);

      if (!formViewData) {
        console.error('[FormBlock.resolveData] Failed to fetch form view configuration');
        return {
          props: {
            ...props,
            _viewName: 'Error loading form',
            _viewDescription: undefined,
            _formConfig: undefined,
            _tableFields: undefined,
            _tableId: undefined,
          },
        };
      }

      console.log('[FormBlock.resolveData] Form view data fetched successfully');
      console.log('[FormBlock.resolveData] Pages:', formViewData.formConfig?.pages?.length);
      console.log('[FormBlock.resolveData] Fields:', formViewData.tableFields?.length);

      // Get table name for display
      const { getTables } = await import('@/app/actions/tables');
      const tables = await getTables();
      const table = tables.find(t => t.id === formViewData.tableId);

      return {
        props: {
          ...props,
          _viewName: formViewData.viewName,
          _viewDescription: formViewData.viewDescription,
          _formConfig: formViewData.formConfig,
          _tableFields: formViewData.tableFields,
          _tableId: formViewData.tableId,
          _tableName: table?.name || `Table ${formViewData.tableId}`,
        },
      };
    } catch (error) {
      console.error('[FormBlock.resolveData] Error:', error);
      return {
        props: {
          ...props,
          _viewName: 'Error loading form',
          _viewDescription: undefined,
          _formConfig: undefined,
          _tableFields: undefined,
          _tableId: undefined,
        },
      };
    }
  },

  render: FormBlock,
};

export default FormBlock;
