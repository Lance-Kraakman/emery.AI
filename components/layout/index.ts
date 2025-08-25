/**
 * Layout components and utilities
 * AIDEV-NOTE: Centralized exports for the new layout system components
 */

export { EmeryLayout } from './EmeryLayout'
export { LayoutProvider, useLayout } from './LayoutProvider'
// CanvasToggle is now handled by BaseCanvas internally
// EmeryChat is now in @/components/chat

export type {
  LayoutState,
  LayoutAction,
  EmeryLayoutProps,
  LayoutProviderProps,
  ChatContextConfig,
  PanelState,
  LayoutBreakpoint
} from './types'

export {
  DEFAULT_LAYOUT_STATE,
  LAYOUT_BREAKPOINTS,
  createChatContextForPage
} from './types'