/**
 * State Types - Type definitions for Page State
 *
 * AIDEV-NOTE: Page State provides client-side state management for Puck pages.
 * State is defined at the page level (not in blocks) and accessible
 * page-wide via {{state.key}} syntax.
 *
 * The state system uses a flat namespace - no containers.
 * All state (including booleans for dialogs/toggles) are just variables.
 * State auto-populates from URL params with matching names.
 */

/**
 * Variable type determines validation and serialization
 */
export type StateVariableType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * A state variable definition (configured in PageStatePanel)
 */
export interface StateVariable {
  /** Variable name (used in references like {{state.variableName}}) */
  name: string;
  /** Variable type for validation */
  type: StateVariableType;
  /** Default value when page loads */
  defaultValue: unknown;
  /** Optional description for documentation */
  description?: string;
}

/**
 * Persistence options for state
 */
export type StatePersistence = 'none' | 'session' | 'localStorage';

/**
 * Page State configuration (stored at page level in DB)
 */
export interface PageStateConfig {
  /** State variables (typed values including booleans for dialogs, toggles, etc.) */
  variables: StateVariable[];
  /** Persistence strategy for all state */
  persistence: StatePersistence;
}

/**
 * Runtime state (flat namespace - single page-wide state)
 */
export interface PageRuntimeState {
  /** The configuration this state was initialized from */
  config: PageStateConfig | undefined;
  /** Current variable values (keyed by variable name) */
  values: Record<string, unknown>;
}

// ============================================
// Page state actions (flat namespace)
// ============================================

/**
 * Page state action types (flat namespace)
 */
export type PageStateActionType =
  | 'INIT_STATE'
  | 'SET_VALUE'
  | 'TOGGLE_VALUE'
  | 'RESET_STATE';

/**
 * Initialize state from page config
 */
export interface InitStateAction {
  type: 'INIT_STATE';
  config: PageStateConfig | undefined;
}

/**
 * Set a value (flat namespace - no container)
 */
export interface PageSetValueAction {
  type: 'SET_VALUE';
  key: string;
  value: unknown;
}

/**
 * Toggle a boolean value (convenience action)
 */
export interface PageToggleValueAction {
  type: 'TOGGLE_VALUE';
  key: string;
}

/**
 * Reset state to initial values
 */
export interface ResetStateAction {
  type: 'RESET_STATE';
}

/**
 * Union of all page state actions (flat namespace)
 */
export type PageStateAction =
  | InitStateAction
  | PageSetValueAction
  | PageToggleValueAction
  | ResetStateAction;

/**
 * Initial page runtime state
 */
export const initialPageRuntimeState: PageRuntimeState = {
  config: undefined,
  values: {},
};

/**
 * Create initial runtime state from page state config
 */
export function createInitialPageState(config: PageStateConfig | undefined): PageRuntimeState {
  if (!config) {
    return { ...initialPageRuntimeState };
  }

  const values: Record<string, unknown> = {};

  for (const variable of config.variables) {
    values[variable.name] = variable.defaultValue;
  }

  return { config, values };
}
