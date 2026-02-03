'use client';

/**
 * StateContext - Page State Management for Puck Pages
 *
 * AIDEV-NOTE: Provides client-side state management using a FLAT namespace.
 * State is defined at the page level via PageStateConfig and accessible
 * via {{state.key}} syntax in text interpolation.
 *
 * Features:
 * - Initialize from PageStateConfig (from page DB)
 * - Auto-populate from URL params with matching names
 * - Get/set values (flat namespace - no containers)
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
  useMemo,
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

    case 'TOGGLE_VALUE': {
      const { key } = action;
      if (!state.config) {
        return state;
      }
      const currentValue = state.values[key];
      return {
        ...state,
        values: {
          ...state.values,
          [key]: !currentValue,
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

  /** Set a value by key */
  setValue: (key: string, value: unknown) => void;

  /** Set a value and optionally sync to URL param */
  setValueWithUrlSync: (key: string, value: unknown, updateUrl?: boolean) => void;

  /** Toggle a boolean value */
  toggleValue: (key: string) => void;

  /** Reset all state to initial values */
  resetState: () => void;

  /** Subscribe to any state change */
  subscribe: (callback: SubscriptionCallback) => () => void;

  /** Get all current values (for debugging or text interpolation) */
  getAllValues: () => Record<string, unknown>;

  /** Get the page state config (for autocomplete) */
  getConfig: () => PageStateConfig | undefined;

  /** Check if a state key exists */
  hasKey: (key: string) => boolean;
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
): { values: Record<string, unknown> } | null {
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
  values: Record<string, unknown>
): void {
  if (config.persistence === 'none' || typeof window === 'undefined') {
    return;
  }

  const storage = config.persistence === 'session' ? sessionStorage : localStorage;
  const key = getStorageKey(pageId);

  try {
    storage.setItem(key, JSON.stringify({ values }));
  } catch (e) {
    console.warn('[StateContext] Failed to save persisted state:', e);
  }
}

/**
 * Parse URL param value based on variable type
 */
function parseUrlParamValue(value: string, type: string): unknown {
  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    case 'object':
    case 'array':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
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
  // Initialize state synchronously using useReducer initializer to avoid first-render timing issues
  const [state, dispatch] = useReducer(
    pageStateReducer,
    pageState,
    (config) => createInitialPageState(config)
  );

  // Track page ID for persistence (use config hash or empty string)
  const pageIdRef = useRef<string>('');

  // Track if we've already initialized (to avoid redundant dispatch on first mount)
  const hasInitializedRef = useRef(false);

  // Handle persistence loading and pageState prop changes
  useEffect(() => {
    // On first mount, state is already initialized via useReducer initializer
    // We only need to load persisted values if applicable
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;

      // Try to load persisted state
      if (pageState && pageState.persistence !== 'none') {
        pageIdRef.current = JSON.stringify(pageState.variables.map(v => v.name)).slice(0, 32);
        const persisted = loadPersistedState(pageState, pageIdRef.current);
        if (persisted) {
          // Set persisted values - check against config variable names (not stale state.values)
          const variableNames = new Set(pageState.variables.map(v => v.name));
          for (const [key, value] of Object.entries(persisted.values)) {
            if (variableNames.has(key)) {
              dispatch({ type: 'SET_VALUE', key, value });
            }
          }
        }
      }
      return;
    }

    // On subsequent changes to pageState prop, re-initialize
    const initialState = createInitialPageState(pageState);

    // Update page ID for persistence
    if (pageState && pageState.persistence !== 'none') {
      pageIdRef.current = JSON.stringify(pageState.variables.map(v => v.name)).slice(0, 32);
      const persisted = loadPersistedState(pageState, pageIdRef.current);
      if (persisted) {
        const mergedValues = { ...initialState.values };
        for (const [key, value] of Object.entries(persisted.values)) {
          if (key in mergedValues) {
            mergedValues[key] = value;
          }
        }

        dispatch({ type: 'INIT_STATE', config: pageState });
        for (const [key, value] of Object.entries(mergedValues)) {
          dispatch({ type: 'SET_VALUE', key, value });
        }
        return;
      }
    }

    dispatch({ type: 'INIT_STATE', config: pageState });
  }, [pageState]);

  // Auto-populate from URL params after initialization
  useEffect(() => {
    if (!state.config || typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);

    for (const variable of state.config.variables) {
      const urlValue = searchParams.get(variable.name);
      if (urlValue !== null) {
        const typedValue = parseUrlParamValue(urlValue, variable.type);
        dispatch({ type: 'SET_VALUE', key: variable.name, value: typedValue });
      }
    }
  }, [state.config]);

  // Persist state changes
  useEffect(() => {
    if (state.config && state.config.persistence !== 'none') {
      savePersistedState(state.config, pageIdRef.current, state.values);
    }
  }, [state.values, state.config]);

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

  // Set a value (with subscriber notification)
  const setValue = useCallback((key: string, value: unknown) => {
    dispatch({ type: 'SET_VALUE', key, value });
    notifySubscribers();
  }, [notifySubscribers]);

  // Set a value with optional URL sync
  const setValueWithUrlSync = useCallback((key: string, value: unknown, updateUrl = true) => {
    dispatch({ type: 'SET_VALUE', key, value });
    notifySubscribers();

    if (updateUrl && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (value === null || value === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, String(value));
      }
      window.history.pushState({}, '', url);
    }
  }, [notifySubscribers]);

  // Toggle a boolean value
  const toggleValue = useCallback((key: string) => {
    dispatch({ type: 'TOGGLE_VALUE', key });
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

  // Get config (for autocomplete)
  const getConfig = useCallback((): PageStateConfig | undefined => {
    return state.config;
  }, [state.config]);

  // Check if key exists
  const hasKey = useCallback((key: string): boolean => {
    return key in state.values;
  }, [state.values]);

  const contextValue: StateContextValue = useMemo(() => ({
    getValue,
    setValue,
    setValueWithUrlSync,
    toggleValue,
    resetState,
    subscribe,
    getAllValues,
    getConfig,
    hasKey,
  }), [getValue, setValue, setValueWithUrlSync, toggleValue, resetState,
       subscribe, getAllValues, getConfig, hasKey]);

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
 * useBooleanState - Hook to get a boolean state value with re-render on change
 *
 * @param key - State key
 * @returns The current boolean value (defaults to false if not set)
 *
 * @example
 * ```tsx
 * function Modal() {
 *   const isOpen = useBooleanState('showModal');
 *   if (!isOpen) return null;
 *   return <div className="modal">...</div>;
 * }
 * ```
 */
export function useBooleanState(key: string): boolean {
  const context = useStateContext();
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to state changes
  useEffect(() => {
    if (!context) return;
    return context.subscribe(forceUpdate);
  }, [context]);

  // Get the value from state
  const value = context?.getValue(key);
  if (value !== undefined) {
    return Boolean(value);
  }

  // Fall back to default from config if value is undefined
  const config = context?.getConfig();
  const varConfig = config?.variables?.find(v => v.name === key);
  return Boolean(varConfig?.defaultValue ?? false);
}
