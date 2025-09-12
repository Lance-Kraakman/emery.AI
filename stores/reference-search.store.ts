/**
 * Reference Search Store - TanStack Store for chat reference search state
 * 
 * Manages unified search state across documents, agents, tables, and tools.
 * Provides debounced search, caching, and error handling for chat reference system.
 * 
 * AIDEV-NOTE: Using TanStack Store for shared state management across components,
 * with built-in performance optimizations like caching and deduplication.
 */

import { Store } from '@tanstack/react-store'
import type { 
  UnifiedReferenceResult, 
  ReferenceSearchResult,
  ReferenceCategory,
  ReferenceSearchOptions 
} from '@/ddd/application/services/ui-support/reference-search-application-service'

// Store state interface
export interface ReferenceSearchState {
  // Current search state
  query: string
  results: UnifiedReferenceResult[]
  totalCount: number
  loading: boolean
  error: string | null
  
  // Performance optimizations
  cache: Map<string, CachedSearchResult>
  lastSearchTime: number
  searchDebounceMs: number
  
  // UI state
  selectedIndex: number
  isOpen: boolean
  triggerType: 'plus' | 'at'
  
  // Search options
  searchOptions: ReferenceSearchOptions
}

export interface CachedSearchResult {
  result: ReferenceSearchResult
  timestamp: number
  expiresAt: number
}

// Initial store state
const initialState: ReferenceSearchState = {
  query: '',
  results: [],
  totalCount: 0,
  loading: false,
  error: null,
  cache: new Map(),
  lastSearchTime: 0,
  searchDebounceMs: 300,
  selectedIndex: 0,
  isOpen: false,
  triggerType: 'at',
  searchOptions: {
    limit: 50,
    includeUnavailable: false,
    categories: ['documents', 'agents', 'tables', 'tools', 'teams', 'settings']
  }
}

// Create the store
export const referenceSearchStore = new Store(initialState)

// Store actions
export const referenceSearchActions = {
  /**
   * Set search query with debouncing
   */
  setQuery: (query: string) => {
    referenceSearchStore.setState((state) => ({
      ...state,
      query,
      selectedIndex: 0 // Reset selection when query changes
    }))
  },

  /**
   * Set search results
   */
  setResults: (searchResult: ReferenceSearchResult) => {
    referenceSearchStore.setState((state) => ({
      ...state,
      results: searchResult.results,
      totalCount: searchResult.totalCount,
      lastSearchTime: searchResult.searchTime,
      loading: false,
      error: null
    }))
  },

  /**
   * Set loading state
   */
  setLoading: (loading: boolean) => {
    referenceSearchStore.setState((state) => ({
      ...state,
      loading
    }))
  },

  /**
   * Set error state
   */
  setError: (error: string | null) => {
    referenceSearchStore.setState((state) => ({
      ...state,
      error,
      loading: false
    }))
  },

  /**
   * Navigate selection up/down
   */
  navigateSelection: (direction: 'up' | 'down') => {
    referenceSearchStore.setState((state) => {
      const maxIndex = state.results.length - 1
      let newIndex = state.selectedIndex

      if (direction === 'down') {
        newIndex = newIndex < maxIndex ? newIndex + 1 : 0
      } else {
        newIndex = newIndex > 0 ? newIndex - 1 : maxIndex
      }

      return {
        ...state,
        selectedIndex: newIndex
      }
    })
  },

  /**
   * Set selected index directly
   */
  setSelectedIndex: (index: number) => {
    referenceSearchStore.setState((state) => ({
      ...state,
      selectedIndex: Math.max(0, Math.min(index, state.results.length - 1))
    }))
  },

  /**
   * Open/close dropdown
   */
  setIsOpen: (isOpen: boolean, triggerType?: 'plus' | 'at') => {
    referenceSearchStore.setState((state) => ({
      ...state,
      isOpen,
      ...(triggerType && { triggerType }),
      ...(isOpen && { selectedIndex: 0 }) // Reset selection when opening
    }))
  },

  /**
   * Update search options
   */
  setSearchOptions: (options: Partial<ReferenceSearchOptions>) => {
    referenceSearchStore.setState((state) => ({
      ...state,
      searchOptions: {
        ...state.searchOptions,
        ...options
      }
    }))
  },

  /**
   * Clear search state
   */
  clear: () => {
    referenceSearchStore.setState((state) => ({
      ...state,
      query: '',
      results: [],
      totalCount: 0,
      loading: false,
      error: null,
      selectedIndex: 0,
      isOpen: false
    }))
  },

  /**
   * Get cached result if available and not expired
   */
  getCachedResult: (query: string): CachedSearchResult | null => {
    const state = referenceSearchStore.state
    const cached = state.cache.get(query)
    
    if (cached && Date.now() < cached.expiresAt) {
      return cached
    }
    
    // Remove expired cache entry
    if (cached) {
      state.cache.delete(query)
    }
    
    return null
  },

  /**
   * Cache search result
   */
  setCachedResult: (query: string, result: ReferenceSearchResult, ttlMs: number = 5 * 60 * 1000) => {
    referenceSearchStore.setState((state) => {
      const cached: CachedSearchResult = {
        result,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlMs
      }
      
      // Create new Map to trigger reactivity
      const newCache = new Map(state.cache)
      newCache.set(query, cached)
      
      // Limit cache size (keep last 100 searches)
      if (newCache.size > 100) {
        const oldestKey = Array.from(newCache.keys())[0]
        newCache.delete(oldestKey)
      }
      
      return {
        ...state,
        cache: newCache
      }
    })
  }
}

// Selectors for computed values
export const referenceSearchSelectors = {
  /**
   * Get current selected result
   */
  getSelectedResult: (): UnifiedReferenceResult | null => {
    const state = referenceSearchStore.state
    return state.results[state.selectedIndex] || null
  },

  /**
   * Check if search has results
   */
  hasResults: (): boolean => {
    return referenceSearchStore.state.results.length > 0
  },

  /**
   * Check if search is empty
   */
  isEmpty: (): boolean => {
    const state = referenceSearchStore.state
    return !state.loading && !state.error && state.results.length === 0 && state.query.trim().length > 0
  },

  /**
   * Get results grouped by category
   */
  getResultsByCategory: (): Record<ReferenceCategory, UnifiedReferenceResult[]> => {
    const state = referenceSearchStore.state
    const grouped: Record<ReferenceCategory, UnifiedReferenceResult[]> = {
      documents: [],
      agents: [],
      tables: [],
      tools: [],
      teams: [],
      settings: []
    }

    state.results.forEach(result => {
      if (grouped[result.category]) {
        grouped[result.category].push(result)
      }
    })

    return grouped
  },

  /**
   * Get search statistics
   */
  getSearchStats: () => {
    const state = referenceSearchStore.state
    return {
      totalResults: state.totalCount,
      displayedResults: state.results.length,
      searchTime: state.lastSearchTime,
      hasMore: state.results.length < state.totalCount,
      cacheSize: state.cache.size
    }
  }
}

// Utility functions
export const referenceSearchUtils = {
  /**
   * Debounce function for search queries
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null
    
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout)
      }
      
      timeout = setTimeout(() => {
        func(...args)
      }, wait)
    }
  },

  /**
   * Check if query is valid for search
   */
  isValidQuery: (query: string): boolean => {
    return query.trim().length >= 1 // Allow single character searches
  },

  /**
   * Format search query for display
   */
  formatQuery: (query: string): string => {
    return query.trim().toLowerCase()
  },

  /**
   * Generate cache key for query + options
   */
  getCacheKey: (query: string, options: ReferenceSearchOptions): string => {
    const optionsKey = JSON.stringify({
      limit: options.limit,
      categories: options.categories?.sort(),
      includeUnavailable: options.includeUnavailable
    })
    return `${query}:${optionsKey}`
  }
}