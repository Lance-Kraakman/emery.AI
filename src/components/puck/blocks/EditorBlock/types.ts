/**
 * EditorBlock Types
 *
 * Type definitions for the EditorBlock Puck component.
 * Extensible for future editor types (pdf, image, code, etc.)
 */

/** Supported editor types */
export type EditorType = 'document'; // Extensible: | 'pdf' | 'image' | 'code' | 'markdown'

/**
 * Document ID source configuration
 * Defines how to get the document ID - from page variable, parent row, or static value
 */
export interface DocumentIdSourceConfig {
  /** Whether to use a page variable, parent row field, or static value */
  valueType: 'variable' | 'parentRow' | 'static';
  /** The value - "{state.varName}", "{rowData.fieldName}", or a static document ID */
  value: string;
}

/** EditorBlock component props */
export interface EditorBlockProps {
  /** Editor type to render */
  editorType: EditorType;

  /** View ID to get table/field metadata from */
  viewId?: number;

  /** Field ID of the document field (selected from view fields) */
  fieldId?: number;

  /** Document ID source configuration (page variable or static) */
  documentIdSource?: DocumentIdSourceConfig;

  /** Resolved table ID (populated by resolveData, hidden from UI) */
  _tableId?: number;

  /** Resolved organization ID (populated by resolveData, hidden from UI) */
  _organizationId?: number;

  /** Editor height (CSS value) */
  height?: string;

  /** Whether editing is allowed */
  allowEdit?: boolean;

  /** Whether to auto-save changes */
  autoSave?: boolean;

  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
}

/** Default props for EditorBlock */
export const defaultEditorBlockProps: EditorBlockProps = {
  editorType: 'document',
  documentIdSource: {
    valueType: 'variable',
    value: '{params.documentId}',
  },
  height: '500px',
  allowEdit: true,
  autoSave: true,
  autoSaveInterval: 3000,
};
