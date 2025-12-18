/**
 * Action types for UI elements (Button, Link, Form, etc.)
 *
 * Actions enable UI elements to trigger operations like:
 * - Assigning tasks to agents
 * - Navigation
 * - Opening URLs
 * - Showing notifications
 *
 * AIDEV-NOTE: AssignTaskAction reuses TaskInstructions from Agent entity for standardization
 */

import type { TaskInstructions } from '@/ddd/domain/agents/entities/agent';

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
 * Action to set a value in a state container
 */
export interface SetStateAction {
  type: 'setState';
  /** State container name */
  container: string;
  /** Variable key */
  key: string;
  /** Value to set (can use templates like {rowData.field}) */
  value: string | number | boolean;
}

/**
 * Action to toggle a UI state flag (boolean)
 */
export interface ToggleUIStateAction {
  type: 'toggleUIState';
  /** State container name */
  container: string;
  /** UI flag key */
  key: string;
}

/**
 * Action to set a UI state flag to a specific value
 */
export interface SetUIStateAction {
  type: 'setUIState';
  /** State container name */
  container: string;
  /** UI flag key */
  key: string;
  /** Value to set */
  value: boolean;
}

/**
 * Action to reset a state container to its initial values
 */
export interface ResetStateAction {
  type: 'resetState';
  /** State container name */
  container: string;
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
  | ToggleUIStateAction
  | SetUIStateAction
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
 * State context interface for action execution
 * Provides access to state operations without importing the full context
 */
export interface ActionStateContext {
  setValue: (container: string, key: string, value: unknown) => void;
  toggleUIState: (container: string, key: string) => void;
  setUIState: (container: string, key: string, value: boolean) => void;
  resetContainer: (container: string) => void;
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
