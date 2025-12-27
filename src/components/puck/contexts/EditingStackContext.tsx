'use client';

/**
 * EditingStackContext
 *
 * Provides editing stack actions to deeply nested Puck components.
 * Replaces the window.dispatchEvent pattern with idiomatic React context.
 *
 * Usage in components:
 *   const { pushDialog } = useEditingStack();
 *   pushDialog(dialogId, dialogName);
 *
 * Note: When outside editor context (public/preview pages), returns no-op functions.
 * Note: DataBlock templates are now edited inline via slots, no pushDataBlock needed.
 */

import { createContext, useContext } from 'react';
import type { EditingStackActions } from '../types/editing-context';

const EditingStackContext = createContext<EditingStackActions | null>(null);

/**
 * Hook to access editing stack actions.
 * Returns no-op functions when not in editor context (e.g., public pages).
 */
export function useEditingStack(): EditingStackActions {
  const ctx = useContext(EditingStackContext);
  if (!ctx) {
    // Return no-op functions when not in editor context
    return {
      pushDialog: () => {},
      pop: () => {},
      navigateToLevel: () => {},
    };
  }
  return ctx;
}

/**
 * Provider component for editing stack actions.
 * Wrap the Puck editor with this to enable context-based communication.
 */
export const EditingStackProvider = EditingStackContext.Provider;
