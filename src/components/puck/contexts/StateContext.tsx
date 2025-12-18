'use client';

/**
 * StateContext - Global State Registry for Puck Pages
 *
 * Provides client-side state management for StateBlock containers.
 * Uses useReducer for predictable state updates and a subscription
 * pattern for targeted re-renders.
 *
 * Features:
 * - Register state containers from StateBlock components
 * - Get/set values and UI state flags
 * - Subscribe to container changes for reactive updates
 * - Optional persistence (session/localStorage)
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  type GlobalState,
  type StateAction,
  type StateContainerConfig,
  type ContainerState,
  initialGlobalState,
  createInitialContainerState,
} from '@/components/puck/types/state';

/**
 * State reducer - handles all state mutations
 */
function stateReducer(state: GlobalState, action: StateAction): GlobalState {
  switch (action.type) {
    case 'REGISTER_CONTAINER': {
      const { config } = action;
      // Don't re-register if already exists with same config
      if (state.containers[config.name]) {
        return state;
      }
      return {
        ...state,
        containers: {
          ...state.containers,
          [config.name]: config,
        },
        states: {
          ...state.states,
          [config.name]: createInitialContainerState(config),
        },
      };
    }

    case 'SET_VALUE': {
      const { container, key, value } = action;
      const containerState = state.states[container];
      if (!containerState) {
        console.warn(`[StateContext] Container "${container}" not registered`);
        return state;
      }
      return {
        ...state,
        states: {
          ...state.states,
          [container]: {
            ...containerState,
            values: {
              ...containerState.values,
              [key]: value,
            },
          },
        },
      };
    }

    case 'TOGGLE_UI_STATE': {
      const { container, key } = action;
      const containerState = state.states[container];
      if (!containerState) {
        console.warn(`[StateContext] Container "${container}" not registered`);
        return state;
      }
      const currentValue = containerState.uiFlags[key] ?? false;
      return {
        ...state,
        states: {
          ...state.states,
          [container]: {
            ...containerState,
            uiFlags: {
              ...containerState.uiFlags,
              [key]: !currentValue,
            },
          },
        },
      };
    }

    case 'SET_UI_STATE': {
      const { container, key, value } = action;
      const containerState = state.states[container];
      if (!containerState) {
        console.warn(`[StateContext] Container "${container}" not registered`);
        return state;
      }
      return {
        ...state,
        states: {
          ...state.states,
          [container]: {
            ...containerState,
            uiFlags: {
              ...containerState.uiFlags,
              [key]: value,
            },
          },
        },
      };
    }

    case 'RESET_CONTAINER': {
      const { container } = action;
      const config = state.containers[container];
      if (!config) {
        console.warn(`[StateContext] Container "${container}" not registered`);
        return state;
      }
      return {
        ...state,
        states: {
          ...state.states,
          [container]: createInitialContainerState(config),
        },
      };
    }

    default:
      return state;
  }
}

/**
 * Subscription callback type
 */
type SubscriptionCallback = () => void;

/**
 * StateContext value interface
 */
export interface StateContextValue {
  /** Get a value from a state container */
  getValue: (container: string, key: string) => unknown;

  /** Get a UI state flag from a container */
  getUIState: (container: string, key: string) => boolean;

  /** Set a value in a state container */
  setValue: (container: string, key: string, value: unknown) => void;

  /** Toggle a UI state flag */
  toggleUIState: (container: string, key: string) => void;

  /** Set a UI state flag to a specific value */
  setUIState: (container: string, key: string, value: boolean) => void;

  /** Reset a container to its initial state */
  resetContainer: (container: string) => void;

  /** Subscribe to changes in a container */
  subscribe: (container: string, callback: SubscriptionCallback) => () => void;

  /** Register a state container (called by StateBlock) */
  registerContainer: (config: StateContainerConfig) => void;

  /** Get the full container state (for debugging) */
  getContainerState: (container: string) => ContainerState | undefined;

  /** Check if a container is registered */
  hasContainer: (container: string) => boolean;
}

const StateContext = createContext<StateContextValue | undefined>(undefined);

export interface StateProviderProps {
  children: ReactNode;
}

/**
 * StateProvider - Provides global state management for Puck pages
 *
 * Should be placed at the page level, wrapping all content that needs
 * access to state containers.
 *
 * @example
 * ```tsx
 * <StateProvider>
 *   <PuckRenderer data={pageData} />
 * </StateProvider>
 * ```
 */
export function StateProvider({ children }: StateProviderProps) {
  const [state, dispatch] = useReducer(stateReducer, initialGlobalState);

  // Subscription management
  const subscribersRef = useRef<Map<string, Set<SubscriptionCallback>>>(new Map());

  // Notify subscribers when a container changes
  const notifySubscribers = useCallback((container: string) => {
    const callbacks = subscribersRef.current.get(container);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }, []);

  // Get a value from a state container
  const getValue = useCallback((container: string, key: string): unknown => {
    const containerState = state.states[container];
    if (!containerState) {
      return undefined;
    }
    return containerState.values[key];
  }, [state.states]);

  // Get a UI state flag
  const getUIState = useCallback((container: string, key: string): boolean => {
    const containerState = state.states[container];
    if (!containerState) {
      return false;
    }
    return containerState.uiFlags[key] ?? false;
  }, [state.states]);

  // Set a value (with subscriber notification)
  const setValue = useCallback((container: string, key: string, value: unknown) => {
    dispatch({ type: 'SET_VALUE', container, key, value });
    // Notify after dispatch (will be batched by React)
    notifySubscribers(container);
  }, [notifySubscribers]);

  // Toggle a UI state flag
  const toggleUIState = useCallback((container: string, key: string) => {
    dispatch({ type: 'TOGGLE_UI_STATE', container, key });
    notifySubscribers(container);
  }, [notifySubscribers]);

  // Set a UI state flag to a specific value
  const setUIState = useCallback((container: string, key: string, value: boolean) => {
    dispatch({ type: 'SET_UI_STATE', container, key, value });
    notifySubscribers(container);
  }, [notifySubscribers]);

  // Reset a container to initial state
  const resetContainer = useCallback((container: string) => {
    dispatch({ type: 'RESET_CONTAINER', container });
    notifySubscribers(container);
  }, [notifySubscribers]);

  // Subscribe to container changes
  const subscribe = useCallback((container: string, callback: SubscriptionCallback): () => void => {
    if (!subscribersRef.current.has(container)) {
      subscribersRef.current.set(container, new Set());
    }
    subscribersRef.current.get(container)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = subscribersRef.current.get(container);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscribersRef.current.delete(container);
        }
      }
    };
  }, []);

  // Register a state container
  const registerContainer = useCallback((config: StateContainerConfig) => {
    dispatch({ type: 'REGISTER_CONTAINER', config });
  }, []);

  // Get full container state (for debugging)
  const getContainerState = useCallback((container: string): ContainerState | undefined => {
    return state.states[container];
  }, [state.states]);

  // Check if container exists
  const hasContainer = useCallback((container: string): boolean => {
    return container in state.containers;
  }, [state.containers]);

  const contextValue: StateContextValue = {
    getValue,
    getUIState,
    setValue,
    toggleUIState,
    setUIState,
    resetContainer,
    subscribe,
    registerContainer,
    getContainerState,
    hasContainer,
  };

  return (
    <StateContext.Provider value={contextValue}>
      {children}
    </StateContext.Provider>
  );
}

/**
 * useStateContext - Hook to access the state context
 *
 * @returns State context value, or undefined if not in a StateProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const stateCtx = useStateContext();
 *   const category = stateCtx?.getValue('filters', 'category');
 *   // ...
 * }
 * ```
 */
export function useStateContext(): StateContextValue | undefined {
  return useContext(StateContext);
}

/**
 * useRequiredStateContext - Hook that throws if not in StateProvider
 *
 * Use this when state context is required (inside StateBlock children).
 */
export function useRequiredStateContext(): StateContextValue {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useRequiredStateContext must be used within a StateProvider');
  }
  return context;
}

/**
 * useStateValue - Hook to get a specific state value with re-render on change
 *
 * @param container - State container name
 * @param key - Variable key
 * @returns The current value
 *
 * @example
 * ```tsx
 * function CategoryDisplay() {
 *   const category = useStateValue('filters', 'category');
 *   return <div>Category: {category}</div>;
 * }
 * ```
 */
export function useStateValue(container: string, key: string): unknown {
  const context = useStateContext();
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to container changes
  React.useEffect(() => {
    if (!context) return;
    return context.subscribe(container, forceUpdate);
  }, [context, container]);

  return context?.getValue(container, key);
}

/**
 * useUIState - Hook to get a UI state flag with re-render on change
 *
 * @param container - State container name
 * @param key - UI flag key
 * @returns The current boolean value
 *
 * @example
 * ```tsx
 * function Modal() {
 *   const isOpen = useUIState('ui', 'showModal');
 *   if (!isOpen) return null;
 *   return <div className="modal">...</div>;
 * }
 * ```
 */
export function useUIState(container: string, key: string): boolean {
  const context = useStateContext();
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to container changes
  React.useEffect(() => {
    if (!context) return;
    return context.subscribe(container, forceUpdate);
  }, [context, container]);

  return context?.getUIState(container, key) ?? false;
}
