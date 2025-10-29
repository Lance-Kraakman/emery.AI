'use client'

import React, { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors, uiStateActions } from '@/stores/ui-state.store'

/**
 * CanvasBase - Minimal canvas wrapper for collapsible pages
 *
 * Provides ONLY essential functionality:
 * - Collapse button to toggle canvas/chat layout
 * - UI state integration for canvas expansion
 * - Flex layout structure for content
 *
 * AIDEV-NOTE: This replaces BasePage with minimal wrapper.
 * Pages should handle their own headers, styling, and backgrounds.
 * The collapse button is the ONLY UI element - it allows chat to expand to full width.
 */

interface CanvasBaseProps {
  children: ReactNode
  className?: string
}

export function CanvasBase({
  children,
  className = ''
}: CanvasBaseProps) {
  // AIDEV-NOTE: Use fine-grained store subscriptions to prevent re-renders
  // when unrelated state (like chatContext) changes
  const canvasState = useStore(uiStateStore, uiStateSelectors.canvasState)
  const toggleCanvas = uiStateActions.toggleCanvas

  return (
    <div className={`flex flex-col h-full relative ${className}`}>
      {/* Canvas Collapse Button - Fixed position, always visible */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCanvas}
        className="absolute top-4 right-4 z-20 h-8 w-8"
        title="Collapse page (make chat main view)"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Page Content - pages handle their own styling */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  )
}
