/**
 * ActionsField - Custom Puck field for configuring actions
 *
 * Provides an improved UI for action configuration with:
 * - Agent selector dropdown for task assignment
 * - UnifiedChatInput for task instructions
 * - Page selector dropdown for navigation
 * - URL input with "Open in New Tab" checkbox
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

import { ActionsFieldRenderer } from '../fields/ActionsFieldRenderer';

/**
 * Create an actions field for Puck blocks
 *
 * @returns Puck custom field configuration for actions
 */
export function createActionsField() {
  return {
    type: "custom" as const,
    label: "Actions",
    render: ActionsFieldRenderer,
  };
}
