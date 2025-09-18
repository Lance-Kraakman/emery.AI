/**
 * Store Utilities - Helper functions for TanStack Store implementation
 */

import type { Store } from '@tanstack/react-store'
import type { PersistenceConfig } from './types'

/**
 * Store persistence utilities for localStorage integration
 */
export const persistence = {
  /**
   * Save store state to localStorage
   */
  save<TState>(key: string, state: TState, config?: PersistenceConfig): void {
    if (typeof window === 'undefined') return
    
    try {
      let dataToSave = state
      
      // Apply whitelist/blacklist filtering
      if (config?.whitelist) {
        dataToSave = Object.keys(state as object).reduce((acc, key) => {
          if (config.whitelist?.includes(key as keyof TState)) {
            (acc as any)[key] = (state as any)[key]
          }
          return acc
        }, {} as TState)
      } else if (config?.blacklist) {
        dataToSave = Object.keys(state as object).reduce((acc, key) => {
          if (!config.blacklist?.includes(key as keyof TState)) {
            (acc as any)[key] = (state as any)[key]
          }
          return acc
        }, {} as TState)
      }
      
      localStorage.setItem(key, JSON.stringify(dataToSave))
    } catch (error) {
      console.warn(`Failed to save store ${key} to localStorage:`, error)
    }
  },

  /**
   * Load store state from localStorage
   */
  load<TState>(key: string, defaultState: TState): Partial<TState> {
    if (typeof window === 'undefined') return {}
    
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        return JSON.parse(saved) as Partial<TState>
      }
    } catch (error) {
      console.warn(`Failed to load store ${key} from localStorage:`, error)
    }
    
    return {}
  },

  /**
   * Setup automatic store persistence
   */
  setupAutoPersist<TState>(
    store: Store<TState>, 
    key: string, 
    config?: PersistenceConfig
  ): () => void {
    if (!config?.enabled) return () => {}

    const unsubscribe = store.subscribe(() => {
      this.save(key, store.state, config)
    })

    return unsubscribe
  }
}

/**
 * Store action creators for consistent patterns
 */
export const createActions = {
  /**
   * Create loading state actions
   */
  loading: <TState extends { loading: boolean; error: string | null }>(
    store: Store<TState>
  ) => ({
    setLoading: (loading: boolean) => {
      store.setState((state) => ({ ...state, loading, error: null }))
    },
    setError: (error: string | null) => {
      store.setState((state) => ({ ...state, loading: false, error }))
    },
    clearError: () => {
      store.setState((state) => ({ ...state, error: null }))
    }
  }),

  /**
   * Create search and filter actions
   */
  searchAndFilter: <TState extends { searchQuery: string }>(
    store: Store<TState>
  ) => ({
    setSearchQuery: (searchQuery: string) => {
      store.setState((state) => ({ ...state, searchQuery }))
    },
    clearSearch: () => {
      store.setState((state) => ({ ...state, searchQuery: '' }))
    }
  }),

  /**
   * Create modal/dialog actions
   */
  modal: <TState extends Record<string, boolean>>(
    store: Store<TState>
  ) => ({
    openModal: (modalKey: keyof TState) => {
      store.setState((state) => ({ ...state, [modalKey]: true }))
    },
    closeModal: (modalKey: keyof TState) => {
      store.setState((state) => ({ ...state, [modalKey]: false }))
    },
    toggleModal: (modalKey: keyof TState) => {
      store.setState((state) => ({ 
        ...state, 
        [modalKey]: !state[modalKey] 
      }))
    }
  })
}

/**
 * Common selectors for consistent patterns
 */
export const selectors = {
  /**
   * Select loading state
   */
  loading: <TState extends { loading: boolean }>(state: TState) => state.loading,
  
  /**
   * Select error state
   */
  error: <TState extends { error: string | null }>(state: TState) => state.error,
  
  /**
   * Select search query
   */
  searchQuery: <TState extends { searchQuery: string }>(state: TState) => state.searchQuery,
  
  /**
   * Check if has error
   */
  hasError: <TState extends { error: string | null }>(state: TState) => !!state.error
}

/**
 * Store debugging utilities
 */
export const debug = {
  /**
   * Log store state changes
   */
  logStateChanges: <TState>(store: Store<TState>, storeName: string) => {
    return store.subscribe((state) => {
      console.group(`[${storeName}] State Update`)
      console.log('New State:', state)
      console.groupEnd()
    })
  },

  /**
   * Create store snapshot for testing
   */
  snapshot: <TState>(store: Store<TState>): TState => {
    return JSON.parse(JSON.stringify(store.state))
  }
}