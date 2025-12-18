/**
 * Action Executor
 *
 * Executes actions triggered by UI elements (Button, Link, Form, etc.)
 * Handles different action types and provides user feedback
 *
 * AIDEV-NOTE: Actions are executed sequentially in the order they are defined
 */

import { toast } from 'sonner';
import { createTask } from '@/app/actions/tasks';
import type { Action, ActionContext, ActionLinkContext } from '../types/actions';
import {
  isDocumentArray,
  isFileArray,
} from '@/ddd/domain/tables/value-objects/field-values';

/**
 * Extract string value from complex field values
 * Uses domain type guards for document/file arrays
 */
function extractStringValue(value: unknown): string {
  if (value == null) return '';

  // Document arrays → comma-separated IDs
  if (isDocumentArray(value)) {
    return value.map(doc => doc.id).join(',');
  }

  // File arrays → comma-separated IDs
  if (isFileArray(value)) {
    return value.map(file => file.id).join(',');
  }

  // Other arrays → comma-separated string values
  if (Array.isArray(value)) {
    return value.map(v => String(v)).join(',');
  }

  // Single object with id → extract id
  if (typeof value === 'object' && 'id' in value) {
    return String((value as { id: unknown }).id);
  }

  return String(value);
}

/**
 * Resolve dynamic values from action context
 * Supports templates like:
 * - {fieldName} - Shorthand for row data (equivalent to {rowData.fieldName})
 * - {rowData.fieldName} - Explicit row data access
 * - {formData.fieldName} - Form data access
 * - {params.name} - Query parameter access
 * - {userId} - Direct context property
 *
 * @param value - The value to resolve (can contain templates)
 * @param context - Action context with available data
 * @returns Resolved value
 */
function resolveDynamicValue(
  value: string | number | string[],
  context: ActionContext
): string | number | string[] {
  // Only process strings
  if (typeof value !== 'string') {
    return value;
  }

  console.log('🔍 resolveDynamicValue called with value:', value);
  console.log('🔍 context.rowData:', context.rowData);
  console.log('🔍 context.rowData keys:', context.rowData ? Object.keys(context.rowData) : 'N/A');

  // Replace template variables: {rowData.id}, {formData.email}, {fieldName}, etc.
  return value.replace(/\{([^}]+)\}/g, (match, path) => {
    console.log('🔍 Resolving variable:', path);
    // Check for shorthand notation (no dots = assume rowData)
    // e.g., {name} -> {rowData.name}
    const effectivePath = path.includes('.') ? path : `rowData.${path}`;
    console.log('🔍 Effective path:', effectivePath);

    const parts = effectivePath.split('.');
    let current: any = context;

    for (const part of parts) {
      console.log('🔍 Traversing part:', part, 'current type:', typeof current, 'part in current:', current && typeof current === 'object' ? part in current : 'N/A');
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
        console.log('🔍 Found! current is now:', current);
      } else {
        // If shorthand failed, try direct context access as fallback
        // e.g., {userId} should still work directly
        if (!path.includes('.')) {
          const directValue = (context as any)[path];
          if (directValue !== undefined) {
            return String(directValue);
          }
        }
        console.warn(`[resolveDynamicValue] Path not found: ${path}`, 'current:', current, 'part:', part);
        return match; // Return original if path not found
      }
    }

    console.log('🔍 Final resolved value:', current);

    return extractStringValue(current);
  });
}

/**
 * Build URL with query parameters
 *
 * @param basePath - Base path for the URL
 * @param queryParams - Query parameters to add
 * @param preserveParams - Array of param names to preserve from current URL
 * @returns Complete URL with query string
 */
function buildUrlWithParams(
  basePath: string,
  queryParams?: Record<string, string | number | string[]>,
  preserveParams?: string[]
): string {
  const url = new URL(basePath, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

  // Preserve existing params if specified
  if (preserveParams && typeof window !== 'undefined') {
    const currentParams = new URLSearchParams(window.location.search);
    preserveParams.forEach(paramName => {
      const value = currentParams.get(paramName);
      if (value !== null) {
        url.searchParams.set(paramName, value);
      }
    });
  }

  // Add new query params
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle array values
        value.forEach(v => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.pathname + url.search;
}

/**
 * Build navigation path based on route context
 * - Public routes: /public/{orgSlug}/{appSlug}/{pageSlug}
 * - Internal routes: /apps/{appId}/pages/{pageId}
 * - Fallback: /pages/{pageId}
 */
function buildPagePath(
  pageId: string,
  linkContext?: ActionLinkContext,
  customPath?: string
): string {
  // Custom path override takes precedence
  if (customPath) {
    return customPath;
  }

  // Public route - use slugs
  if (linkContext?.orgSlug && linkContext?.appSlug) {
    const pages = linkContext.pages;
    let pageSlug: string | undefined;

    if (pages) {
      if (pages instanceof Map) {
        const page = pages.get(Number(pageId));
        pageSlug = page?.slug;
      } else if (Array.isArray(pages)) {
        const page = pages.find(p => String(p.id) === pageId);
        pageSlug = page?.slug;
      }
    }

    if (pageSlug) {
      return `/public/${linkContext.orgSlug}/${linkContext.appSlug}/${pageSlug}`;
    }

    console.warn(`[buildPagePath] Could not find slug for pageId: ${pageId}`);
  }

  // Internal route - use IDs
  if (linkContext?.appId) {
    return `/apps/${linkContext.appId}/pages/${pageId}`;
  }

  // Fallback
  return `/pages/${pageId}`;
}

/**
 * Execute a single action with the provided context
 *
 * @param action - The action to execute
 * @param context - Context data available to the action
 * @returns Promise that resolves when action completes
 */
export async function executeAction(
  action: Action,
  context: ActionContext
): Promise<void> {
  try {
    switch (action.type) {
      case 'assignTask': {
        // Create a task for the specified agent
        const result = await createTask({
          agentId: action.agentId,
          name: `Task from ${context.pageId || 'app builder'}`,
          instructions: action.taskInstructions,
          createdBy: context.userId,
        });

        if (!result.success) {
          toast.error(result.error || 'Failed to assign task');
          throw new Error(result.error || 'Failed to assign task');
        }

        toast.success('Task assigned successfully');
        break;
      }

      case 'navigateToPage': {
        // Navigate to another page with optional query params
        const basePath = buildPagePath(action.pageId, context.linkContext, action.path);

        // Resolve dynamic values in query params
        let resolvedParams: Record<string, string | number | string[]> | undefined;
        if (action.queryParams) {
          resolvedParams = {};
          Object.entries(action.queryParams).forEach(([key, value]) => {
            resolvedParams![key] = resolveDynamicValue(value, context);
          });
        }

        // Build complete URL with query params
        const fullPath = buildUrlWithParams(basePath, resolvedParams, action.preserveParams);

        // Client-side navigation only
        if (typeof window !== 'undefined') {
          window.location.href = fullPath;
        }
        break;
      }

      case 'openUrl': {
        // Open URL in new tab or current window
        if (typeof window !== 'undefined') {
          if (action.newTab) {
            window.open(action.url, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = action.url;
          }
        }
        break;
      }

      case 'showNotification': {
        // Show toast notification
        switch (action.variant) {
          case 'success':
            toast.success(action.message);
            break;
          case 'error':
            toast.error(action.message);
            break;
          case 'warning':
            toast.warning(action.message);
            break;
          case 'info':
          default:
            toast.info(action.message);
            break;
        }
        break;
      }

      case 'updateQueryParams': {
        // Update query parameters without navigation
        if (typeof window === 'undefined') {
          console.warn('[updateQueryParams] Not available on server');
          break;
        }

        const url = new URL(window.location.href);

        // Clear existing params if mode is 'replace'
        if (action.mode === 'replace') {
          url.search = '';
        }

        // Resolve and apply new params
        Object.entries(action.params).forEach(([key, value]) => {
          if (value === null) {
            // Remove param if value is null
            url.searchParams.delete(key);
          } else {
            const resolvedValue = resolveDynamicValue(value, context);
            if (Array.isArray(resolvedValue)) {
              // Handle array values
              url.searchParams.delete(key); // Clear existing first
              resolvedValue.forEach(v => url.searchParams.append(key, String(v)));
            } else {
              url.searchParams.set(key, String(resolvedValue));
            }
          }
        });

        // Update URL without page reload
        window.history.pushState({}, '', url.toString());

        // Dispatch event for components to react to param changes
        window.dispatchEvent(new Event('queryparamschange'));
        break;
      }

      case 'setState': {
        // Set a value in a state container
        if (!context.stateContext) {
          console.warn('[setState] No state context available');
          break;
        }

        // Resolve dynamic value if it's a string template
        let resolvedValue: unknown = action.value;
        if (typeof action.value === 'string') {
          resolvedValue = resolveDynamicValue(action.value, context);
        }

        context.stateContext.setValue(action.container, action.key, resolvedValue);
        break;
      }

      case 'toggleUIState': {
        // Toggle a UI state flag
        if (!context.stateContext) {
          console.warn('[toggleUIState] No state context available');
          break;
        }

        context.stateContext.toggleUIState(action.container, action.key);
        break;
      }

      case 'setUIState': {
        // Set a UI state flag to a specific value
        if (!context.stateContext) {
          console.warn('[setUIState] No state context available');
          break;
        }

        context.stateContext.setUIState(action.container, action.key, action.value);
        break;
      }

      case 'resetState': {
        // Reset a state container to initial values
        if (!context.stateContext) {
          console.warn('[resetState] No state context available');
          break;
        }

        context.stateContext.resetContainer(action.container);
        break;
      }

      default: {
        // Type guard to ensure all action types are handled
        const _exhaustive: never = action;
        throw new Error(`Unknown action type: ${(_exhaustive as any).type}`);
      }
    }
  } catch (error) {
    console.error('[executeAction] Error executing action:', error);
    toast.error(error instanceof Error ? error.message : 'Action failed');
    throw error;
  }
}

/**
 * Execute multiple actions sequentially
 *
 * @param actions - Array of actions to execute
 * @param context - Context data available to actions
 * @returns Promise that resolves when all actions complete
 *
 * @example
 * ```tsx
 * const actions: Action[] = [
 *   { type: 'assignTask', agentId: 1, taskInstructions: {...} },
 *   { type: 'showNotification', message: 'Task created!', variant: 'success' }
 * ];
 *
 * await executeActions(actions, context);
 * ```
 */
export async function executeActions(
  actions: Action[],
  context: ActionContext
): Promise<void> {
  if (!actions || actions.length === 0) {
    return;
  }

  for (const action of actions) {
    await executeAction(action, context);
  }
}
