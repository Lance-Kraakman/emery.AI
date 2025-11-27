/**
 * ActionsField - Custom Puck field for configuring actions
 *
 * AIDEV-NOTE: Uses Puck's "array" field type to allow users to configure
 * multiple actions that execute on click/submit (e.g., Button, Link, Form).
 *
 * Usage:
 * ```typescript
 * import { createActionsField } from './custom-fields/actions-field';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     actions: createActionsField()
 *   }
 * }
 * ```
 */

import type { ArrayField } from "@measured/puck";
import type { Action } from '../types/actions';

/**
 * Create an actions array field for Puck blocks
 *
 * @returns Puck array field configuration for actions
 */
export function createActionsField() {
  return {
    type: "array" as const,
    label: "Actions",
    arrayFields: {
      type: {
        label: "Action Type",
        type: "select" as const,
        options: [
          { label: "Assign Task to Agent", value: "assignTask" },
          { label: "Navigate to Page", value: "navigateToPage" },
          { label: "Open URL", value: "openUrl" },
          { label: "Show Notification", value: "showNotification" },
        ],
      },

      // AssignTask fields
      agentId: {
        label: "Agent",
        type: "number",
        // TODO: Replace with agent selector dropdown
        // For now, users enter agent ID manually
      },
      taskInstructions: {
        label: "Task Instructions",
        type: "object",
        objectFields: {
          task: {
            label: "Task Description",
            type: "textarea",
          },
          // TODO: Add support for images, attachments, tools, metadata
        },
      },

      // NavigateToPage fields
      pageId: {
        label: "Page ID",
        type: "text",
      },
      path: {
        label: "Path (optional)",
        type: "text",
      },

      // OpenUrl fields
      url: {
        label: "URL",
        type: "text",
      },
      newTab: {
        label: "Open in New Tab",
        type: "radio",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },

      // ShowNotification fields
      message: {
        label: "Message",
        type: "text",
      },
      variant: {
        label: "Notification Type",
        type: "select",
        options: [
          { label: "Success", value: "success" },
          { label: "Error", value: "error" },
          { label: "Warning", value: "warning" },
          { label: "Info", value: "info" },
        ],
      },
    },
    defaultItemProps: {
      type: "showNotification",
      message: "Action executed",
      variant: "info",
    } as Action,
    getItemSummary: (action: Action) => {
      switch (action.type) {
        case "assignTask":
          return `Assign task to agent #${action.agentId}`;
        case "navigateToPage":
          return `Navigate to ${action.path || action.pageId}`;
        case "openUrl":
          return `Open ${action.url}${action.newTab ? " (new tab)" : ""}`;
        case "showNotification":
          return `Show ${action.variant}: ${action.message}`;
        default:
          return "Unknown action";
      }
    },
  };
}
