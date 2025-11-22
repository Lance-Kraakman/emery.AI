/**
 * Link Action Field
 *
 * Custom field for Puck that provides a comprehensive link/button action system.
 * Supports internal page links, external URLs, sign in/out actions, and custom overrides.
 *
 * Usage:
 * ```ts
 * import { createLinkActionField } from './custom-fields';
 *
 * fields: {
 *   action: createLinkActionField({
 *     label: 'Button Action',
 *     allowedActionTypes: ['page', 'url', 'signIn', 'signOut']
 *   })
 * }
 * ```
 */

import { LinkActionFieldRenderer } from '../fields/LinkActionField';

export type LinkActionType = 'none' | 'page' | 'url' | 'signIn' | 'signOut';

/**
 * Configuration for a link/button action
 */
export interface LinkActionConfig {
  /** Type of action to perform */
  actionType: LinkActionType;

  /** For actionType: 'page' - ID of the page to link to */
  pageId?: number;

  /** For actionType: 'url' - External or custom URL */
  url?: string;

  /** Whether to open URL in new tab */
  openInNewTab?: boolean;

  /** For actionType: 'signIn' | 'signOut' - URL to redirect to after auth action */
  redirectAfter?: string;

  /** Custom HREF override - takes precedence over all other settings */
  customHref?: string;
}

export interface LinkActionFieldConfig {
  /** Label for the field */
  label?: string;

  /** Which action types are allowed (defaults to all) */
  allowedActionTypes?: LinkActionType[];

  /** Default action type when creating new items */
  defaultActionType?: LinkActionType;
}

/**
 * Factory function to create a link action field
 */
export function createLinkActionField(params: LinkActionFieldConfig = {}) {
  // Create a closure to pass params to the renderer
  const renderFn = (props: any) => {
    return LinkActionFieldRenderer({
      ...props,
      field: {
        label: params.label,
        allowedActionTypes: params.allowedActionTypes || ['none', 'page', 'url', 'signIn', 'signOut'],
        defaultActionType: params.defaultActionType || 'none',
      },
    });
  };

  return {
    type: 'custom' as const,
    label: params.label || 'Link Action',
    render: renderFn,
  };
}
