/**
 * Store Types - Shared types and interfaces for TanStack Store implementation
 */

import type { Store } from '@tanstack/react-store'

// Base store configuration
export interface BaseStoreConfig {
  loading: boolean
  error: string | null
}

// UI State types
export type PanelState = 'expanded' | 'collapsed'
export type LayoutBreakpoint = 'mobile' | 'tablet' | 'desktop'


// Persistence configuration
export interface PersistenceConfig {
  key: string
  enabled: boolean
  whitelist?: (keyof any)[]
  blacklist?: (keyof any)[]
}

export interface SearchAndFilter {
  searchQuery: string
  selectedTeam: string
  selectedCategory: string
}

export interface LoadingState {
  isLoading: boolean
  isRefreshing: boolean
}

export interface ErrorState {
  error: string | null
  hasError: boolean
}