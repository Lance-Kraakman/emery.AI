'use client'

import React, { ReactNode } from 'react'
import { Button } from '@/src/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { useLayout } from '@/src/components/layout/LayoutProvider'

/**
 * BasePage - Base page structure for all page types
 * 
 * Provides:
 * - Common page header structure
 * - Page collapse functionality (to let chat take full width)
 * - Consistent styling across all page types
 * 
 * AIDEV-NOTE: Each page's main content should extend this base page structure.
 */

interface BasePageProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  headerActions?: ReactNode
  className?: string
}

export function BasePage({ 
  title, 
  subtitle, 
  icon, 
  children, 
  headerActions,
  className = ''
}: BasePageProps) {
  const { canvasState, toggleCanvas } = useLayout()

  // Note: Visibility now controlled by EmeryChat's conditional layout
  // BasePage always renders and lets EmeryChat decide when to show it

  return (
    <div className={`flex flex-col h-full bg-card ${className}`}>
      {/* Page Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20 relative">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div className="flex-shrink-0 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-lg text-foreground truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {headerActions}
          
          {/* Page Collapse Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCanvas}
            className="h-8 w-8"
            title="Collapse page (make chat main view)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  )
}