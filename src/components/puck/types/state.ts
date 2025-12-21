/**
 * State Types - Type definitions for Page State
 *
 * AIDEV-NOTE: Page State provides client-side state management for Puck pages.
 * State is defined at the page level (not in blocks) and accessible
 * page-wide via {state.key} syntax.
 *
 * The state system uses a flat namespace - no containers.
 * Variables and UI flags are accessed directly by name.
 */

/**
 * Variable type determines validation and serialization
 */
export type StateVariableType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * A state variable definition (configured in PageStatePanel)
 */
export interface StateVariable {
  /** Variable name (used in references like {state.variableName}) */
  name: string;
  /** Variable type for validation */
  type: StateVariableType;
  /** Default value when page loads */
  defaultValue: unknown;
  /** Optional description for documentation */
  description?: string;
}

/**
 * A UI state flag (boolean for dialogs, tabs, etc.)
 */
export interface UIStateFlag {
  /** Flag name (used in references like {state.flagName}) */
  name: string;
  /** Default value (typically false) */
  defaultValue: boolean;
  /** Optional description */
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
  /** State variables (typed values) */
  variables: StateVariable[];
  /** UI state flags (boolean toggles for dialogs, panels, etc.) */
  uiFlags: UIStateFlag[];
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
  /** Current UI state flags (keyed by flag name) */
  uiFlags: Record<string, boolean>;
}

// ============================================
// New flat namespace actions
// ============================================

/**
 * Page state action types (flat namespace)
 */
export type PageStateActionType =
  | 'INIT_STATE'
  | 'SET_VALUE'
  | 'TOGGLE_UI_FLAG'
  | 'SET_UI_FLAG'
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
 * Toggle a UI flag (flat namespace)
 */
export interface PageToggleUIFlagAction {
  type: 'TOGGLE_UI_FLAG';
  key: string;
}

/**
 * Set a UI flag to specific value (flat namespace)
 */
export interface PageSetUIFlagAction {
  type: 'SET_UI_FLAG';
  key: string;
  value: boolean;
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
  | PageToggleUIFlagAction
  | PageSetUIFlagAction
  | ResetStateAction;

/**
 * Initial page runtime state
 */
export const initialPageRuntimeState: PageRuntimeState = {
  config: undefined,
  values: {},
  uiFlags: {},
};

/**
 * Create initial runtime state from page state config
 */
export function createInitialPageState(config: PageStateConfig | undefined): PageRuntimeState {
  if (!config) {
    return { ...initialPageRuntimeState };
  }

  const values: Record<string, unknown> = {};
  const uiFlags: Record<string, boolean> = {};

  for (const variable of config.variables) {
    values[variable.name] = variable.defaultValue;
  }

  for (const flag of config.uiFlags) {
    uiFlags[flag.name] = flag.defaultValue;
  }

  return { config, values, uiFlags };
}

// ============================================
// @deprecated - Legacy container-based types
// Will be removed when StateBlock is deleted
// ============================================

/**
 * @deprecated Use PageStateConfig instead - StateBlock is being removed
 */
export interface StateContainerConfig {
  name: string;
  variables: StateVariable[];
  uiState: UIStateFlag[];
  persistence: StatePersistence;
}

/**
 * @deprecated Use PageRuntimeState instead
 */
export interface ContainerState {
  values: Record<string, unknown>;
  uiFlags: Record<string, boolean>;
}

/**
 * @deprecated Legacy action types
 */
export type StateActionType =
  | 'SET_VALUE'
  | 'TOGGLE_UI_STATE'
  | 'SET_UI_STATE'
  | 'RESET_CONTAINER'
  | 'REGISTER_CONTAINER';

/** @deprecated */
export interface SetValueAction {
  type: 'SET_VALUE';
  container: string;
  key: string;
  value: unknown;
}

/** @deprecated */
export interface ToggleUIStateAction {
  type: 'TOGGLE_UI_STATE';
  container: string;
  key: string;
}

/** @deprecated */
export interface SetUIStateAction {
  type: 'SET_UI_STATE';
  container: string;
  key: string;
  value: boolean;
}

/** @deprecated */
export interface ResetContainerAction {
  type: 'RESET_CONTAINER';
  container: string;
}

/** @deprecated */
export interface RegisterContainerAction {
  type: 'REGISTER_CONTAINER';
  config: StateContainerConfig;
}

/** @deprecated */
export type StateAction =
  | SetValueAction
  | ToggleUIStateAction
  | SetUIStateAction
  | ResetContainerAction
  | RegisterContainerAction;

/** @deprecated */
export interface GlobalState {
  containers: Record<string, StateContainerConfig>;
  states: Record<string, ContainerState>;
}

/** @deprecated */
export const initialGlobalState: GlobalState = {
  containers: {},
  states: {},
};

/** @deprecated */
export function createInitialContainerState(config: StateContainerConfig): ContainerState {
  const values: Record<string, unknown> = {};
  const uiFlags: Record<string, boolean> = {};

  for (const variable of config.variables) {
    values[variable.name] = variable.defaultValue;
  }

  for (const flag of config.uiState) {
    uiFlags[flag.name] = flag.defaultValue;
  }

  return { values, uiFlags };
}

/** @deprecated */
export function setStateValue(container: string, key: string, value: unknown): SetValueAction {
  return { type: 'SET_VALUE', container, key, value };
}

/** @deprecated */
export function toggleUIState(container: string, key: string): ToggleUIStateAction {
  return { type: 'TOGGLE_UI_STATE', container, key };
}

/** @deprecated */
export function setUIState(container: string, key: string, value: boolean): SetUIStateAction {
  return { type: 'SET_UI_STATE', container, key, value };
}

/** @deprecated */
export function resetContainer(container: string): ResetContainerAction {
  return { type: 'RESET_CONTAINER', container };
}

/** @deprecated */
export function registerContainer(config: StateContainerConfig): RegisterContainerAction {
  return { type: 'REGISTER_CONTAINER', config };
}
