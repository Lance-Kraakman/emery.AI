'use client';

import React, { useEffect, type ComponentType } from 'react';
import { ComponentConfig } from '@measured/puck';
import { useStateContext } from '../../contexts/StateContext';
import type {
  StateVariable,
  UIStateFlag,
  StatePersistence,
  StateContainerConfig,
} from '../../types/state';

/**
 * StateBlock Props
 *
 * A container block that defines client-side state for its children.
 * Children can access state values using {state.containerName.variableName}
 */
export interface StateBlockProps {
  /** Unique container name (used in state references) */
  name: string;
  /** State variables with types and default values */
  variables: StateVariable[];
  /** UI state flags (boolean values for dialogs, tabs, etc.) */
  uiState: UIStateFlag[];
  /** Persistence strategy for state */
  persistence: StatePersistence;
  /** Child content that can access this state - Puck passes as ComponentType */
  children?: ComponentType<{
    className?: string;
    allow?: string[];
    disallow?: string[];
  }>;
}

/**
 * StateBlock - Client-side state container for Puck pages
 *
 * Provides state management for child components. State can be:
 * - Variables: typed values (string, number, boolean, object, array)
 * - UI State: boolean flags for visibility, toggles, etc.
 *
 * State is referenced using {state.containerName.variableName} syntax.
 *
 * @example
 * ```tsx
 * <StateBlock
 *   name="filters"
 *   variables={[{ name: "category", type: "string", defaultValue: "all" }]}
 *   uiState={[{ name: "showAdvanced", defaultValue: false }]}
 *   persistence="session"
 * >
 *   {children}
 * </StateBlock>
 * ```
 */
function StateBlockComponent({
  name,
  variables,
  uiState,
  persistence,
  children: Children,
}: StateBlockProps) {
  const stateContext = useStateContext();

  // Register container on mount
  useEffect(() => {
    if (!stateContext || !name) return;

    const config: StateContainerConfig = {
      name,
      variables: variables || [],
      uiState: uiState || [],
      persistence: persistence || 'none',
    };

    stateContext.registerContainer(config);

    // Handle persistence restoration on mount
    if (persistence !== 'none') {
      const storageKey = `puck-state-${name}`;
      const storage = persistence === 'localStorage' ? localStorage : sessionStorage;

      try {
        const saved = storage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Restore values
          if (parsed.values) {
            Object.entries(parsed.values).forEach(([key, value]) => {
              stateContext.setValue(name, key, value);
            });
          }
          // Restore UI flags
          if (parsed.uiFlags) {
            Object.entries(parsed.uiFlags).forEach(([key, value]) => {
              stateContext.setUIState(name, key, value as boolean);
            });
          }
        }
      } catch (error) {
        console.warn(`[StateBlock] Failed to restore state for "${name}":`, error);
      }
    }
  }, [name, stateContext, persistence, variables, uiState]);

  // Handle persistence save on state changes
  useEffect(() => {
    if (!stateContext || !name || persistence === 'none') return;

    const storageKey = `puck-state-${name}`;
    const storage = persistence === 'localStorage' ? localStorage : sessionStorage;

    const unsubscribe = stateContext.subscribe(name, () => {
      const containerState = stateContext.getContainerState(name);
      if (containerState) {
        try {
          storage.setItem(storageKey, JSON.stringify(containerState));
        } catch (error) {
          console.warn(`[StateBlock] Failed to save state for "${name}":`, error);
        }
      }
    });

    return unsubscribe;
  }, [name, stateContext, persistence]);

  // Render children (StateBlock is invisible container)
  // Children is a ComponentType from Puck slots
  // Return empty fragment if no children (Puck components can't return null)
  return Children ? <Children /> : <></>;
}

/**
 * StateBlock Puck configuration
 */
export const StateBlock: ComponentConfig<StateBlockProps> = {
  label: 'State Container',
  fields: {
    name: {
      type: 'text',
      label: 'Container Name',
    },
    variables: {
      type: 'array',
      label: 'Variables',
      getItemSummary: (item: StateVariable) =>
        `${item.name || 'unnamed'} (${item.type || 'string'})`,
      arrayFields: {
        name: {
          type: 'text',
          label: 'Name',
        },
        type: {
          type: 'select',
          label: 'Type',
          options: [
            { value: 'string', label: 'String' },
            { value: 'number', label: 'Number' },
            { value: 'boolean', label: 'Boolean' },
            { value: 'object', label: 'Object' },
            { value: 'array', label: 'Array' },
          ],
        },
        defaultValue: {
          type: 'text',
          label: 'Default Value',
        },
        description: {
          type: 'text',
          label: 'Description',
        },
      },
      defaultItemProps: {
        name: '',
        type: 'string',
        defaultValue: '',
        description: '',
      },
    },
    uiState: {
      type: 'array',
      label: 'UI State Flags',
      getItemSummary: (item: UIStateFlag) =>
        item.name || 'unnamed',
      arrayFields: {
        name: {
          type: 'text',
          label: 'Name',
        },
        defaultValue: {
          type: 'radio',
          label: 'Default',
          options: [
            { value: false, label: 'Off' },
            { value: true, label: 'On' },
          ],
        },
        description: {
          type: 'text',
          label: 'Description',
        },
      },
      defaultItemProps: {
        name: '',
        defaultValue: false,
        description: '',
      },
    },
    persistence: {
      type: 'select',
      label: 'Persistence',
      options: [
        { value: 'none', label: 'None (reset on refresh)' },
        { value: 'session', label: 'Session (until tab closes)' },
        { value: 'localStorage', label: 'Local Storage (persistent)' },
      ],
    },
    children: {
      type: 'slot',
    },
  },
  defaultProps: {
    name: 'myState',
    variables: [],
    uiState: [],
    persistence: 'none',
  },
  render: StateBlockComponent,
};
