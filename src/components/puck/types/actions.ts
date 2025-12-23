/**
 * Action types for UI elements (Button, Link, Form, etc.)
 *
 * AIDEV-NOTE: Actions enable UI elements to trigger operations like:
 * - Assigning tasks to agents
 * - Navigation
 * - Opening URLs
 * - Showing notifications
 * - State management (flat namespace - no containers)
 */

import type { TaskInstructions } from '@/ddd/domain/tasks/entities/task';

/**
 * Action to assign a task to an agent
 * Uses standardized TaskInstructions structure from Agent entity
 */
export interface AssignTaskAction {
  type: 'assignTask';
  agentId: number;
  taskInstructions: TaskInstructions;
}

/**
 * Action to navigate to another page in the app
 */
export interface NavigateAction {
  type: 'navigateToPage';
  pageId: string;
  path?: string; // Optional: custom path override
  queryParams?: Record<string, string | number | string[]>; // Query parameters to pass
  preserveParams?: string[]; // Keep existing query params
}

/**
 * Action to open a URL (external or internal)
 */
export interface OpenUrlAction {
  type: 'openUrl';
  url: string;
  newTab: boolean;
}

/**
 * Action to show a toast notification
 */
export interface NotificationAction {
  type: 'showNotification';
  message: string;
  variant: 'success' | 'error' | 'info' | 'warning';
}

/**
 * Action to update query parameters without navigation
 * Useful for filtering/sorting without page reload
 */
export interface UpdateQueryParamsAction {
  type: 'updateQueryParams';
  params: Record<string, string | number | string[] | null>; // null removes the param
  mode: 'merge' | 'replace'; // merge keeps existing params, replace clears them
}

/**
 * Action to set a value in page state (flat namespace)
 */
export interface SetStateAction {
  type: 'setState';
  /** Variable key (flat namespace - no container) */
  key: string;
  /** Value to set (can use templates like {rowData.field}) */
  value: string | number | boolean;
  /** Whether to also update the URL param (default: true) */
  updateUrl?: boolean;
}

/**
 * Action to toggle a UI flag (boolean)
 */
export interface ToggleUIFlagAction {
  type: 'toggleUIFlag';
  /** UI flag key (flat namespace) */
  key: string;
}

/**
 * Action to set a UI flag to a specific value
 */
export interface SetUIFlagAction {
  type: 'setUIFlag';
  /** UI flag key (flat namespace) */
  key: string;
  /** Value to set */
  value: boolean;
}

/**
 * Action to reset all state to initial values
 */
export interface ResetStateAction {
  type: 'resetState';
}

/**
 * Union type of all possible actions
 */
export type Action =
  | AssignTaskAction
  | NavigateAction
  | OpenUrlAction
  | NotificationAction
  | UpdateQueryParamsAction
  | SetStateAction
  | ToggleUIFlagAction
  | SetUIFlagAction
  | ResetStateAction;

/**
 * Link context for URL construction in actions
 */
export interface ActionLinkContext {
  /** Organization slug for constructing public URLs */
  orgSlug?: string;
  /** App slug for constructing public URLs */
  appSlug?: string;
  /** App ID for constructing internal URLs */
  appId?: number;
  /** Pages data for slug lookup */
  pages?: Map<number, { id: number; slug: string }> | Array<{ id: number; slug: string }>;
  /** Whether we're in the Puck editor */
  isEditing?: boolean;
  /** Whether we're in preview mode */
  isPreview?: boolean;
}

/**
 * State context interface for action execution (flat namespace)
 */
export interface ActionStateContext {
  setValue: (key: string, value: unknown) => void;
  setValueWithUrlSync: (key: string, value: unknown, updateUrl?: boolean) => void;
  toggleUIFlag: (key: string) => void;
  setUIFlag: (key: string, value: boolean) => void;
  resetState: () => void;
}

/**
 * Context provided to actions during execution
 * Contains current state and data available to the action
 */
export interface ActionContext {
  /** Current row data if action is triggered from within a Repeat element */
  rowData?: Record<string, any>;

  /** Form data if action is triggered from a form submission */
  formData?: Record<string, any>;

  /** Current user ID */
  userId?: string;

  /** Current page ID */
  pageId?: string;

  /** Additional metadata */
  metadata?: Record<string, any>;

  /** Link context for URL construction */
  linkContext?: ActionLinkContext;

  /** State context for state actions */
  stateContext?: ActionStateContext;
}
