/**
 * EditorBlock - Puck Component Configuration
 *
 * Universal editor/viewer block for documents and files.
 * Category: "Content" - Content display and editing blocks
 *
 * Currently supports:
 * - document: TipTap rich text editor
 *
 * Future support planned for:
 * - pdf, image, code, markdown, audio, video
 *
 * Configuration UX:
 * - Uses ViewManagementField for view selection
 * - Dynamic document field selector (filtered to document type)
 * - Page Variable / Static Value toggle for document ID source
 */

import type { ComponentConfig } from '@measured/puck';
import { EditorBlock as EditorBlockComponent } from './EditorBlock';
import type { EditorBlockProps, DocumentIdSourceConfig } from './types';
import { defaultEditorBlockProps } from './types';
import { createViewManagementField } from '../../custom-fields';
import { getView } from '@/app/actions/views';
import { DocumentFieldSelector } from '../../fields/DocumentFieldSelector';
import { DocumentIdSourceField } from '../../fields/DocumentIdSourceField';

export const EditorBlock: ComponentConfig<EditorBlockProps> = {
  label: 'Editor',

  fields: {
    editorType: {
      type: 'select',
      label: 'Editor Type',
      options: [
        { label: 'Document (TipTap)', value: 'document' },
        // Future options:
        // { label: 'PDF Viewer', value: 'pdf' },
        // { label: 'Image Viewer', value: 'image' },
        // { label: 'Code Editor', value: 'code' },
        // { label: 'Markdown Editor', value: 'markdown' },
      ],
    },

    // View selector using shared ViewManagementField
    viewId: createViewManagementField({
      supportedViewTypes: ['grid'],
      label: 'Data Source (View)',
    }),

    // NOTE: fieldId and documentIdSource are created dynamically in resolveFields
    // to capture viewId in closure for the custom field renderers

    height: {
      type: 'text',
      label: 'Height',
    },

    allowEdit: {
      type: 'radio',
      label: 'Allow Editing',
      options: [
        { label: 'Yes', value: true },
        { label: 'No (View Only)', value: false },
      ],
    },

    autoSave: {
      type: 'radio',
      label: 'Auto-save',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },

    autoSaveInterval: {
      type: 'number',
      label: 'Auto-save Interval (ms)',
      min: 1000,
      max: 60000,
    },

    // Hidden fields populated by resolveData
    _tableId: { type: 'number', label: 'Table ID', visible: false },
    _organizationId: { type: 'number', label: 'Organization ID', visible: false },
  },

  defaultProps: defaultEditorBlockProps,

  /**
   * Dynamically show/hide fields based on viewId selection.
   * Creates custom field renderers with viewId in closure.
   */
  resolveFields: (data, { fields }) => {
    const viewId = data.props.viewId;

    // Base fields always shown
    const baseFields = {
      editorType: fields.editorType,
      viewId: fields.viewId,
    };

    // If no view selected, only show base fields
    if (!viewId) {
      return baseFields;
    }

    // View selected - show document field and ID source
    return {
      ...baseFields,

      // Document field selector (filtered to document type)
      fieldId: {
        type: 'custom' as const,
        label: 'Document Field',
        render: ({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) => (
          <DocumentFieldSelector
            key={viewId} // Force remount when viewId changes
            value={value}
            onChange={onChange}
            viewId={viewId}
          />
        ),
      },

      // Document ID source (page variable or static)
      documentIdSource: {
        type: 'custom' as const,
        label: 'Document ID',
        render: ({ value, onChange }: { value: DocumentIdSourceConfig | undefined; onChange: (v: DocumentIdSourceConfig) => void }) => (
          <DocumentIdSourceField
            key={viewId} // Force remount when viewId changes
            value={value}
            onChange={onChange}
          />
        ),
      },

      // Display options
      height: fields.height,
      allowEdit: fields.allowEdit,
      autoSave: fields.autoSave,
      autoSaveInterval: fields.autoSaveInterval,
    };
  },

  /**
   * Server-side data resolution.
   * Fetches tableId and organizationId from the selected view.
   */
  resolveData: async ({ props }) => {
    // No view selected
    if (!props.viewId || isNaN(props.viewId)) {
      return {
        props: {
          ...props,
          _tableId: undefined,
          _organizationId: undefined,
        },
      };
    }

    try {
      const view = await getView(props.viewId);

      if (!view) {
        console.error('[EditorBlock.resolveData] Failed to get view');
        return {
          props: {
            ...props,
            _tableId: undefined,
            _organizationId: undefined,
          },
        };
      }

      return {
        props: {
          ...props,
          _tableId: view.tableId,
          _organizationId: view.organizationId,
        },
      };
    } catch (error) {
      console.error('[EditorBlock.resolveData] Error:', error);
      return {
        props: {
          ...props,
          _tableId: undefined,
          _organizationId: undefined,
        },
      };
    }
  },

  render: EditorBlockComponent,
};

export { EditorBlockComponent };
export type { EditorBlockProps };
