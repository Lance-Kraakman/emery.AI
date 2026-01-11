/**
 * Page Dialogs Configuration
 *
 * AIDEV-NOTE: Defines dialog configurations stored at page level.
 * Dialogs are controlled by boolean state variables and edited
 * separately from the main page canvas via a dedicated panel.
 */

import type { Data as PuckData } from '@measured/puck';

/**
 * Dialog size options
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Individual dialog configuration
 */
export interface PageDialog {
  /** Unique identifier for the dialog */
  id: string;
  /** Display name for the dialog (used in panel) */
  name: string;
  /** Boolean state variable key that controls open/close */
  stateKey: string;
  /** Dialog title (supports variable interpolation) */
  title: string;
  /** Optional dialog description */
  description?: string;
  /** Dialog size */
  size: DialogSize;
  /** Whether clicking outside closes the dialog */
  closeOnOutsideClick: boolean;
  /** Whether pressing Escape closes the dialog */
  closeOnEscape: boolean;
  /** Puck content for dialog body */
  content: PuckData;
}

/**
 * Page dialogs configuration stored at page level
 */
export interface PageDialogsConfig {
  /** Array of dialog configurations */
  dialogs: PageDialog[];
}

/**
 * Create a new empty dialog with default values
 */
export function createEmptyDialog(id: string): PageDialog {
  return {
    id,
    name: 'New Dialog',
    stateKey: '',
    title: '',
    description: '',
    size: 'md',
    closeOnOutsideClick: true,
    closeOnEscape: true,
    content: {
      root: { props: {} },
      content: [],
      zones: {},
    },
  };
}

/**
 * Create empty page dialogs config
 */
export function createEmptyPageDialogsConfig(): PageDialogsConfig {
  return {
    dialogs: [],
  };
}

/**
 * Validate page dialogs config structure
 */
export function isValidPageDialogsConfig(config: unknown): config is PageDialogsConfig {
  if (!config || typeof config !== 'object') return false;
  const cfg = config as Record<string, unknown>;
  if (!Array.isArray(cfg.dialogs)) return false;
  return true;
}
