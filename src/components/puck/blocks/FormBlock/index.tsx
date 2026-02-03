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
import { getFormViewConfiguration } from "@/app/actions/views";
import { getTables } from "@/app/actions/tables";
import { createViewManagementField } from "../../custom-fields";
import { FormConfigFieldRenderer } from "../../fields/FormConfigFieldRenderer";

export const FormBlockConfig: ComponentConfig<FormBlockProps> = {
  label: "Form",

  fields: {
    // View Selection - Inline creation and editing support
    viewId: createViewManagementField({
      supportedViewTypes: ['form'],
      label: 'Form View',
    }),
  },

  defaultProps: {},

  /**
   * Conditionally show form config field when a view is selected and resolved
   */
  resolveFields: (data, { fields }) => {
    const viewId = data.props.viewId;
    const formConfig = data.props._formConfig;
    const tableFields = data.props._tableFields;

    // Always show view selector
    const baseFields: Record<string, any> = {
      viewId: fields.viewId,
    };

    // Show form configuration field when view is selected and data resolved
    if (viewId && formConfig && tableFields) {
      baseFields.formConfig = {
        type: 'custom' as const,
        label: 'Form Configuration',
        render: (renderProps: any) => {
          return FormConfigFieldRenderer({
            ...renderProps,
            formConfig,
            tableFields,
            viewId,
            field: { label: 'Form Configuration' },
          });
        },
      };
    }

    return baseFields;
  },

  /**
   * Resolve data on the server
   *
   * AIDEV-NOTE: This executes on the server during SSR/SSG.
   * Fetches form view configuration so the client component receives complete data.
   */
  resolveData: async ({ props }) => {
    console.log('[FormBlock.resolveData] Starting resolution for view:', props.viewId);

    if (!props.viewId || isNaN(props.viewId)) {
      console.log('[FormBlock.resolveData] No valid viewId provided');
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
