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

// Chat related types
export interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp?: Date
}

export interface ChatContext {
  chatId?: string
  domainType?: string
  domainId?: number
  tableId?: number
}

// Form state types
export interface FormState {
  isSubmitting: boolean
  errors: Record<string, string>
  isDirty: boolean
  isValid: boolean
}

// Store action types for consistency
export interface StoreAction<TPayload = any> {
  type: string
  payload?: TPayload
}

// Store selector type helper
export type StoreSelector<TState, TSelected> = (state: TState) => TSelected

// Generic store utilities
export type StoreInstance<TState> = Store<TState>

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