/**
 * Editing Context Types
 *
 * Shared types for the page editor's editing stack.
 * Supports nested editing: Page -> Dialog
 *
 * Note: DataBlock templates are now edited inline via Puck's native slots.
 * No separate editing level needed - slot content is managed by Puck automatically.
 */

import type { Data } from '@measured/puck';

/**
 * Represents an item in the editing stack.
 * The stack starts with 'page' and can have dialogs nested.
 *
 * Note: DataBlocks no longer have separate editing levels.
 * Their templates are edited inline via Puck slots.
 */
export type EditingContextItem =
  | { type: 'page' }
  | { type: 'dialog'; dialogId: string; dialogName: string };

/**
 * Legacy type for backwards compatibility.
 * Use EditingContextItem for new code.
 */
export type EditingTarget = 'page' | { dialogId: string; dialogName: string };

/**
 * Actions available from the EditingStackContext.
 * Used by child components to push new editing levels onto the stack.
 *
 * Note: DataBlock templates are now edited inline via Puck's native slots.
 * No pushDataBlock action needed - slot content is managed by Puck automatically.
 */
export interface EditingStackActions {
  /** Push a dialog onto the editing stack */
  pushDialog: (dialogId: string, dialogName: string) => void;
  /** Pop the current level and return to parent */
  pop: () => void;
  /**
   * Navigate to a specific level in the stack (0 = page).
   * If currentAppState is provided, saves the current content before navigating.
   */
  navigateToLevel: (level: number, currentAppState?: Data) => void;
}
