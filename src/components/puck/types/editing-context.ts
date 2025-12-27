/**
 * Editing Context Types
 *
 * Shared types for the page editor's editing stack.
 * Supports nested editing: Page -> Dialog -> DataBlock -> DataBlock...
 *
 * DataBlock templates use viewId/tableId to fetch fields fresh via TemplateEditorContext,
 * avoiding stale data issues from passing fields through the stack.
 */

import type { Data } from '@measured/puck';

/**
 * Represents an item in the editing stack.
 * The stack starts with 'page' and can have dialogs or datablocks nested.
 *
 * For datablocks, only viewId and tableId are stored - fields are fetched
 * fresh by TemplateEditorContext when entering template edit mode.
 */
export type EditingContextItem =
  | { type: 'page' }
  | { type: 'dialog'; dialogId: string; dialogName: string }
  | {
      type: 'datablock';
      componentId: string;
      name: string;
      viewId: number;
      tableId: number;
    };

/**
 * Legacy type for backwards compatibility.
 * Use EditingContextItem for new code.
 */
export type EditingTarget = 'page' | { dialogId: string; dialogName: string };

/**
 * Actions available from the EditingStackContext.
 * Used by child components to push new editing levels onto the stack.
 */
export interface EditingStackActions {
  /**
   * Push a DataBlock template onto the editing stack.
   *
   * Note: currentAppState is NOT passed here - it's injected by PuckEditorLayout
   * which wraps this call and adds appState.data from usePuck().
   *
   * viewId and tableId are used to fetch fields fresh by TemplateEditorContext.
   */
  pushDataBlock: (
    componentId: string,
    name: string,
    templateContent: Data,
    viewId: number,
    tableId: number
  ) => void;
  /** Push a dialog onto the editing stack */
  pushDialog: (dialogId: string, dialogName: string) => void;
  /** Pop the current level and return to parent */
  pop: () => void;
  /** Navigate to a specific level in the stack (0 = page) */
  navigateToLevel: (level: number) => void;
}
