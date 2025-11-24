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
 * Union type of all possible actions
 */
export type Action =
  | AssignTaskAction
  | NavigateAction
  | OpenUrlAction
  | NotificationAction
  | UpdateQueryParamsAction;

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
}
