'use client'

import React, { ReactNode } from 'react'

/**
 * CanvasBase - Minimal canvas wrapper for pages
 *
 * Provides ONLY essential functionality:
 * - Flex layout structure for content
 *
 * AIDEV-NOTE: This replaces BasePage with minimal wrapper.
 * Pages should handle their own headers, styling, and backgrounds.
 * The collapse button has been removed - resizable right panel handles layout now.
 */

interface CanvasBaseProps {
  children: ReactNode
  className?: string
}

export function CanvasBase({
  children,
  className = ''
}: CanvasBaseProps) {
  return (
    <div className={`flex flex-col relative h-full ${className}`}>
      {/* Page Content - pages handle their own styling */}
      <div className="flex-1 relative">
        {children}
      </div>
    </div>
  )
}
