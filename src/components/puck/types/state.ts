/**
 * State Types - Type definitions for StateBlock and StateContext
 *
 * StateBlock provides client-side state containers for Puck pages.
 * Each container holds variables and UI state flags that can be
 * referenced by other components via ValueSource.
 */

/**
 * Variable type determines validation and serialization
 */
export type StateVariableType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * A state variable definition (configured in StateBlock)
 */
export interface StateVariable {
  /** Variable name (used in references like {state.container.name}) */
  name: string;
  /** Variable type for validation */
  type: StateVariableType;
  /** Default value when container initializes */
  defaultValue: unknown;
  /** Optional description for documentation */
  description?: string;
}

/**
 * A UI state flag (boolean for dialogs, tabs, etc.)
 */
export interface UIStateFlag {
  /** Flag name (used in references like {state.container.flagName}) */
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
 * State container configuration (defined by StateBlock)
 */
export interface StateContainerConfig {
  /** Container name (unique identifier) */
  name: string;
  /** Variable definitions */
  variables: StateVariable[];
  /** UI state flag definitions */
  uiState: UIStateFlag[];
  /** Persistence strategy */
  persistence: StatePersistence;
}

/**
 * Runtime state for a container
 */
export interface ContainerState {
  /** Current variable values (keyed by variable name) */
  values: Record<string, unknown>;
  /** Current UI state flags (keyed by flag name) */
  uiFlags: Record<string, boolean>;
}

/**
 * State action types
 */
export type StateActionType =
  | 'SET_VALUE'
  | 'TOGGLE_UI_STATE'
  | 'SET_UI_STATE'
  | 'RESET_CONTAINER'
  | 'REGISTER_CONTAINER';

/**
 * State action payloads
 */
export interface SetValueAction {
  type: 'SET_VALUE';
  container: string;
  key: string;
  value: unknown;
}

export interface ToggleUIStateAction {
  type: 'TOGGLE_UI_STATE';
  container: string;
  key: string;
}

export interface SetUIStateAction {
  type: 'SET_UI_STATE';
  container: string;
  key: string;
  value: boolean;
}

export interface ResetContainerAction {
  type: 'RESET_CONTAINER';
  container: string;
}

export interface RegisterContainerAction {
  type: 'REGISTER_CONTAINER';
  config: StateContainerConfig;
}

/**
 * Union of all state actions
 */
export type StateAction =
  | SetValueAction
  | ToggleUIStateAction
  | SetUIStateAction
  | ResetContainerAction
  | RegisterContainerAction;

/**
 * Global state shape (all containers)
 */
export interface GlobalState {
  /** Container configurations (keyed by name) */
  containers: Record<string, StateContainerConfig>;
  /** Container runtime states (keyed by name) */
  states: Record<string, ContainerState>;
}

/**
 * Initial global state
 */
export const initialGlobalState: GlobalState = {
  containers: {},
  states: {},
};

/**
 * Create initial container state from config
 */
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

/**
 * Helper to create a setState action
 */
export function setStateValue(container: string, key: string, value: unknown): SetValueAction {
  return { type: 'SET_VALUE', container, key, value };
}

/**
 * Helper to create a toggleUIState action
 */
export function toggleUIState(container: string, key: string): ToggleUIStateAction {
  return { type: 'TOGGLE_UI_STATE', container, key };
}

/**
 * Helper to create a setUIState action
 */
export function setUIState(container: string, key: string, value: boolean): SetUIStateAction {
  return { type: 'SET_UI_STATE', container, key, value };
}

/**
 * Helper to create a resetContainer action
 */
export function resetContainer(container: string): ResetContainerAction {
  return { type: 'RESET_CONTAINER', container };
}

/**
 * Helper to create a registerContainer action
 */
export function registerContainer(config: StateContainerConfig): RegisterContainerAction {
  return { type: 'REGISTER_CONTAINER', config };
}
