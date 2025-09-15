'use client'

/**
 * Tool Panel Component
 *
 * Always-visible panel showing selected tools from chat.
 * Supports artifact opening for doc/file tools and remove functionality.
 * Replaces the old ReferencesPanel with better UX.
 */

import React, { useState } from 'react'
import { FileText, File, Database, Users, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReferenceToolDTO } from '@/app/mappers/reference-tool-mapper'
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types'

interface ToolPanelProps {
  tools?: ReferenceToolDTO[] // Selected tools
  onToolClick: (tool: ReferenceToolDTO) => void // Handle tool click (artifact opening, etc.)
  onAddTool?: () => void // Trigger @ dropdown for adding tools
  onRemoveTool?: (tool: ReferenceToolDTO) => void // Remove tool from selection
  isLoading?: boolean
  className?: string
}

interface ToolCardProps {
  tool: ReferenceToolDTO
  onClick: () => void
  onRemove?: () => void
}

function ToolCard({ tool, onClick, onRemove }: ToolCardProps) {
  // Determine icon based on tool category
  const getIcon = () => {
    switch (tool.category) {
      case ReferenceCategory.DOC:
        return <FileText className="h-4 w-4 text-blue-600" />
      case ReferenceCategory.FILE:
        return <File className="h-4 w-4 text-green-600" />
      case ReferenceCategory.TABLE:
        return <Database className="h-4 w-4 text-purple-600" />
      case ReferenceCategory.AGENT:
        return <Users className="h-4 w-4 text-orange-600" />
      case ReferenceCategory.DATABASE:
        return <Database className="h-4 w-4 text-gray-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  // Get display name from DTO
  const getDisplayName = () => {
    return tool.displayName
  }

  // Check if tool can be opened as artifact
  const canOpenArtifact = tool.supportsArtifacts

  return (
    <div className="relative flex items-center group">
      <button
        onClick={onClick}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-md border text-sm
          transition-colors duration-150 flex-shrink-0 max-w-xs
          border-border bg-background hover:bg-muted/50 cursor-pointer
          ${canOpenArtifact ? 'hover:border-blue-300' : ''}
        `}
        title={`${tool.description}${canOpenArtifact ? ' (Click to view)' : ''}`}
      >
        {getIcon()}
        <span className="truncate font-medium">
          {getDisplayName()}
        </span>
        {canOpenArtifact && (
          <span className="text-xs text-blue-500 ml-1">📄</span>
        )}
      </button>

      {/* Remove button - shows on hover */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove tool"
        >
          <X className="w-2 h-2" />
        </button>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background animate-pulse">
      <div className="h-4 w-4 bg-muted rounded" />
      <div className="h-4 w-20 bg-muted rounded" />
    </div>
  )
}

export function ToolPanel({
  tools = [],
  onToolClick,
  onAddTool,
  onRemoveTool,
  isLoading = false,
  className = ""
}: ToolPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Tools are already DTOs

  return (
    <div className={`border-t border-border bg-muted/10 ${className}`}>
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Tools
              {isCollapsed ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {!isLoading && tools.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {tools.length}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Add tool"
            onClick={onAddTool}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Tools */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {/* Loading State */}
            {isLoading && (
              <>
                <LoadingSkeleton />
                <LoadingSkeleton />
              </>
            )}

            {/* Selected Tools */}
            {tools.length > 0 ? (
              tools.map((toolDTO, index) => (
                <ToolCard
                  key={`${toolDTO.category}-${toolDTO.id}-${index}`}
                  tool={toolDTO}
                  onClick={() => onToolClick(toolDTO)} // Pass DTO
                  onRemove={onRemoveTool ? () => onRemoveTool(toolDTO) : undefined}
                />
              ))
            ) : !isLoading ? (
              /* Empty State with Helpful Hint */
              <div className="text-sm text-muted-foreground py-2">
                Type @ to add tools, documents, agents, and more
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}