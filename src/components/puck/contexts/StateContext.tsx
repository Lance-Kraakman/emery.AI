'use client';

/**
 * StateContext - Page State Management for Puck Pages
 *
 * AIDEV-NOTE: Provides client-side state management using a FLAT namespace.
 * State is defined at the page level via PageStateConfig and accessible
 * via {state.key} syntax in text interpolation.
 *
 * Features:
 * - Initialize from PageStateConfig (from page DB)
 * - Get/set values and UI flags (flat namespace - no containers)
 * - Subscribe to changes for reactive updates
 * - Optional persistence (session/localStorage)
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import {
  type PageRuntimeState,
  type PageStateAction,
  type PageStateConfig,
  initialPageRuntimeState,
  createInitialPageState,
} from '@/components/puck/types/state';

/**
 * Page state reducer - handles all state mutations (flat namespace)
 */
function pageStateReducer(state: PageRuntimeState, action: PageStateAction): PageRuntimeState {
  switch (action.type) {
    case 'INIT_STATE': {
      return createInitialPageState(action.config);
    }

    case 'SET_VALUE': {
      const { key, value } = action;
      // Don't warn if state not initialized - just ignore
      if (!state.config) {
        return state;
      }
      return {
        ...state,
        values: {
          ...state.values,
          [key]: value,
        },
      };
    }

    case 'TOGGLE_UI_FLAG': {
      const { key } = action;
      if (!state.config) {
        return state;
      }
      const currentValue = state.uiFlags[key] ?? false;
      return {
        ...state,
        uiFlags: {
          ...state.uiFlags,
          [key]: !currentValue,
        },
      };
    }

    case 'SET_UI_FLAG': {
      const { key, value } = action;
      if (!state.config) {
        return state;
      }
      return {
        ...state,
        uiFlags: {
          ...state.uiFlags,
          [key]: value,
        },
      };
    }

    case 'RESET_STATE': {
      return createInitialPageState(state.config);
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
 * StateContext value interface (flat namespace API)
 */
export interface StateContextValue {
  /** Get a value by key */
  getValue: (key: string) => unknown;

  /** Get a UI flag by key */
  getUIFlag: (key: string) => boolean;

  /** Set a value by key */
  setValue: (key: string, value: unknown) => void;

  /** Toggle a UI flag */
  toggleUIFlag: (key: string) => void;

  /** Set a UI flag to a specific value */
  setUIFlag: (key: string, value: boolean) => void;

  /** Reset all state to initial values */
  resetState: () => void;

  /** Subscribe to any state change */
  subscribe: (callback: SubscriptionCallback) => () => void;

  /** Get all current values (for debugging or text interpolation) */
  getAllValues: () => Record<string, unknown>;

  /** Get all UI flags */
  getAllUIFlags: () => Record<string, boolean>;

  /** Get the page state config (for autocomplete) */
  getConfig: () => PageStateConfig | undefined;

  /** Check if a state key exists */
  hasKey: (key: string) => boolean;

  /** Check if a UI flag exists */
  hasUIFlag: (key: string) => boolean;
}

const StateContext = createContext<StateContextValue | undefined>(undefined);

export interface StateProviderProps {
  children: ReactNode;
  /** Page state configuration from DB */
  pageState?: PageStateConfig;
}

/**
 * Get storage key for persistence
 */
function getStorageKey(pageId: string): string {
  return `emery_page_state_${pageId}`;
}

/**
 * Load persisted state from storage
 */
function loadPersistedState(
  config: PageStateConfig,
  pageId: string
): { values: Record<string, unknown>; uiFlags: Record<string, boolean> } | null {
  if (config.persistence === 'none' || typeof window === 'undefined') {
    return null;
  }

  const storage = config.persistence === 'session' ? sessionStorage : localStorage;
  const key = getStorageKey(pageId);

  try {
    const stored = storage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[StateContext] Failed to load persisted state:', e);
  }

  return null;
}

/**
 * Save state to storage
 */
function savePersistedState(
  config: PageStateConfig,
  pageId: string,
  values: Record<string, unknown>,
  uiFlags: Record<string, boolean>
): void {
  if (config.persistence === 'none' || typeof window === 'undefined') {
    return;
  }

  const storage = config.persistence === 'session' ? sessionStorage : localStorage;
  const key = getStorageKey(pageId);

  try {
    storage.setItem(key, JSON.stringify({ values, uiFlags }));
  } catch (e) {
    console.warn('[StateContext] Failed to save persisted state:', e);
  }
}

/**
 * StateProvider - Provides page state management
 *
 * @example
 * ```tsx
 * <StateProvider pageState={page.pageState}>
 *   <PuckRenderer data={pageData} />
 * </StateProvider>
 * ```
 */
export function StateProvider({ children, pageState }: StateProviderProps) {
  const [state, dispatch] = useReducer(pageStateReducer, initialPageRuntimeState);

  // Track page ID for persistence (use config hash or empty string)
  const pageIdRef = useRef<string>('');

  // Initialize state when pageState config changes
  useEffect(() => {
    // Create initial state
    const initialState = createInitialPageState(pageState);

    // Try to load persisted state
    if (pageState && pageState.persistence !== 'none') {
      // Use a simple hash of the config for page identification
      pageIdRef.current = JSON.stringify(pageState.variables.map(v => v.name)).slice(0, 32);
      const persisted = loadPersistedState(pageState, pageIdRef.current);
      if (persisted) {
        // Merge persisted values with initial state (only for known keys)
        const mergedValues = { ...initialState.values };
        const mergedFlags = { ...initialState.uiFlags };

        for (const [key, value] of Object.entries(persisted.values)) {
          if (key in mergedValues) {
            mergedValues[key] = value;
          }
        }
        for (const [key, value] of Object.entries(persisted.uiFlags)) {
          if (key in mergedFlags) {
            mergedFlags[key] = value;
          }
        }

        dispatch({ type: 'INIT_STATE', config: pageState });
        // Set persisted values
        for (const [key, value] of Object.entries(mergedValues)) {
          dispatch({ type: 'SET_VALUE', key, value });
        }
        for (const [key, value] of Object.entries(mergedFlags)) {
          dispatch({ type: 'SET_UI_FLAG', key, value });
        }
        return;
      }
    }

    dispatch({ type: 'INIT_STATE', config: pageState });
  }, [pageState]);

  // Persist state changes
  useEffect(() => {
    if (state.config && state.config.persistence !== 'none') {
      savePersistedState(state.config, pageIdRef.current, state.values, state.uiFlags);
    }
  }, [state.values, state.uiFlags, state.config]);

  // Subscription management
  const subscribersRef = useRef<Set<SubscriptionCallback>>(new Set());

  // Notify all subscribers when state changes
  const notifySubscribers = useCallback(() => {
    subscribersRef.current.forEach(callback => callback());
  }, []);

  // Get a value
  const getValue = useCallback((key: string): unknown => {
    return state.values[key];
  }, [state.values]);

  // Get a UI flag
  const getUIFlag = useCallback((key: string): boolean => {
    return state.uiFlags[key] ?? false;
  }, [state.uiFlags]);

  // Set a value (with subscriber notification)
  const setValue = useCallback((key: string, value: unknown) => {
    dispatch({ type: 'SET_VALUE', key, value });
    notifySubscribers();
  }, [notifySubscribers]);

  // Toggle a UI flag
  const toggleUIFlag = useCallback((key: string) => {
    dispatch({ type: 'TOGGLE_UI_FLAG', key });
    notifySubscribers();
  }, [notifySubscribers]);

  // Set a UI flag to a specific value
  const setUIFlag = useCallback((key: string, value: boolean) => {
    dispatch({ type: 'SET_UI_FLAG', key, value });
    notifySubscribers();
  }, [notifySubscribers]);

  // Reset state to initial values
  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
    notifySubscribers();
  }, [notifySubscribers]);

  // Subscribe to state changes
  const subscribe = useCallback((callback: SubscriptionCallback): () => void => {
    subscribersRef.current.add(callback);

    // Return unsubscribe function
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Get all values (for text interpolation)
  const getAllValues = useCallback((): Record<string, unknown> => {
    return { ...state.values };
  }, [state.values]);

  // Get all UI flags
  const getAllUIFlags = useCallback((): Record<string, boolean> => {
    return { ...state.uiFlags };
  }, [state.uiFlags]);

  // Get config (for autocomplete)
  const getConfig = useCallback((): PageStateConfig | undefined => {
    return state.config;
  }, [state.config]);

  // Check if key exists
  const hasKey = useCallback((key: string): boolean => {
    return key in state.values;
  }, [state.values]);

  // Check if UI flag exists
  const hasUIFlag = useCallback((key: string): boolean => {
    return key in state.uiFlags;
  }, [state.uiFlags]);

  const contextValue: StateContextValue = {
    getValue,
    getUIFlag,
    setValue,
    toggleUIFlag,
    setUIFlag,
    resetState,
    subscribe,
    getAllValues,
    getAllUIFlags,
    getConfig,
    hasKey,
    hasUIFlag,
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
 *   const category = stateCtx?.getValue('category');
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
 * Use this when state context is required.
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
 * @param key - Variable key
 * @returns The current value
 *
 * @example
 * ```tsx
 * function CategoryDisplay() {
 *   const category = useStateValue('category');
 *   return <div>Category: {category}</div>;
 * }
 * ```
 */
export function useStateValue(key: string): unknown {
  const context = useStateContext();
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to state changes
  useEffect(() => {
    if (!context) return;
    return context.subscribe(forceUpdate);
  }, [context]);

  return context?.getValue(key);
}

/**
 * useUIFlag - Hook to get a UI flag with re-render on change
 *
 * @param key - UI flag key
 * @returns The current boolean value
 *
 * @example
 * ```tsx
 * function Modal() {
 *   const isOpen = useUIFlag('showModal');
 *   if (!isOpen) return null;
 *   return <div className="modal">...</div>;
 * }
 * ```
 */
export function useUIFlag(key: string): boolean {
  const context = useStateContext();
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to state changes
  useEffect(() => {
    if (!context) return;
    return context.subscribe(forceUpdate);
  }, [context]);

  return context?.getUIFlag(key) ?? false;
}

// ============================================
// Backward compatibility exports
// Will be removed when StateBlock is deleted
// ============================================

/**
 * @deprecated Use useStateValue(key) instead
 */
export function useOldStateValue(container: string, key: string): unknown {
  // Just ignore the container
  return useStateValue(key);
}

/**
 * @deprecated Use useUIFlag(key) instead
 */
export function useUIState(container: string, key: string): boolean {
  // Just ignore the container
  return useUIFlag(key);
}
