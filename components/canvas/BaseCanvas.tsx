'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { useLayout } from '@/components/layout/LayoutProvider'

/**
 * BaseCanvas - Base canvas structure for all page types
 * 
 * Provides:
 * - Common canvas header structure
 * - Canvas collapse functionality
 * - Consistent styling across all canvas types
 * 
 * AIDEV-NOTE: Each page's main content should extend this base canvas structure.
 */

interface BaseCanvasProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  headerActions?: ReactNode
  className?: string
}

export function BaseCanvas({ 
  title, 
  subtitle, 
  icon, 
  children, 
  headerActions,
  className = ''
}: BaseCanvasProps) {
  const { canvasState, toggleCanvas } = useLayout()

  // Only render when canvas is expanded
  if (canvasState !== 'expanded') {
    return null
  }

  return (
    <div className={`flex flex-col h-full bg-card ${className}`}>
      {/* Canvas Header */}
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
          
          {/* Canvas Collapse Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCanvas}
            className="h-8 w-8"
            title="Collapse canvas (make chat main view)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  )
}