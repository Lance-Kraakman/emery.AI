'use client'

import React, { useState, useEffect } from 'react'
import { FileText, File, Database, Users, Plus, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveReferences } from '@/app/actions/references'
import type { ReferenceDTO, ReferencePanelStateDTO } from '@/app/mappers/reference-mapper'

interface ReferencesPanelProps {
  referenceTexts?: string[] // Reference texts to resolve (@doc:path, @file:path)
  resolvedReferences?: ReferenceDTO[] // Pre-resolved references
  onReferenceClick: (reference: ReferenceDTO) => void
  isLoading?: boolean
  className?: string
}

interface ReferenceCardProps {
  reference: ReferenceDTO
  onClick: () => void
}

function ReferenceCard({ reference, onClick }: ReferenceCardProps) {
  // Determine icon based on reference category
  const getIcon = () => {
    switch (reference.category) {
      case 'doc':
        return <FileText className="h-4 w-4 text-blue-600" />
      case 'file':
        return <File className="h-4 w-4 text-green-600" />
      case 'table':
        return <Database className="h-4 w-4 text-purple-600" />
      case 'agent':
        return <Users className="h-4 w-4 text-orange-600" />
      case 'database':
        return <Database className="h-4 w-4 text-gray-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  // Get display name from DTO
  const getDisplayName = () => {
    if (reference.metadata?.error) {
      return `${reference.displayName} (not found)`
    }

    return reference.displayName
  }

  return (
    <button
      onClick={onClick}
      disabled={!!reference.metadata?.error}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-md border text-sm
        transition-colors duration-150 flex-shrink-0 max-w-xs
        ${reference.metadata?.error
          ? 'border-red-200 bg-red-50 text-red-600 cursor-not-allowed'
          : 'border-border bg-background hover:bg-muted/50 cursor-pointer'
        }
      `}
      title={reference.description}
    >
      {getIcon()}
      <span className="truncate font-medium">
        {getDisplayName()}
      </span>
    </button>
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

export function ReferencesPanel({
  referenceTexts,
  resolvedReferences: propResolvedReferences,
  onReferenceClick,
  isLoading: propIsLoading = false,
  className = ""
}: ReferencesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [panelState, setPanelState] = useState<ReferencePanelStateDTO>({
    resolvedReferences: propResolvedReferences || [],
    isLoading: propIsLoading,
    isCollapsed: false
  })

  // Resolve references when referenceTexts prop changes
  useEffect(() => {
    if (referenceTexts && referenceTexts.length > 0) {
      resolveReferenceTexts(referenceTexts)
    } else if (propResolvedReferences) {
      // Use pre-resolved references
      setPanelState(prev => ({
        ...prev,
        resolvedReferences: propResolvedReferences,
        isLoading: propIsLoading
      }))
    }
  }, [referenceTexts, propResolvedReferences, propIsLoading])

  const resolveReferenceTexts = async (texts: string[]) => {
    try {
      setPanelState(prev => ({ ...prev, isLoading: true, error: undefined }))

      const result = await resolveReferences(texts)
      if (result.success && result.data) {
        setPanelState(prev => ({
          ...prev,
          resolvedReferences: result.data!.resolvedReferences,
          isLoading: false,
          error: undefined
        }))
      } else {
        setPanelState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Failed to resolve references'
        }))
      }
    } catch (error) {
      console.error('Error resolving references:', error)
      setPanelState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }

  // Don't render if no references and not loading
  if (!panelState.isLoading && panelState.resolvedReferences.length === 0 && !panelState.error) {
    return null
  }

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
              Referenced
              {isCollapsed ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {!panelState.isLoading && panelState.resolvedReferences.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {panelState.resolvedReferences.length}
              </span>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Add reference"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* References */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {/* Error State */}
            {panelState.error && (
              <div className="px-3 py-2 rounded-md border border-red-200 bg-red-50 text-red-600 text-sm">
                {panelState.error}
              </div>
            )}

            {/* Loading State */}
            {panelState.isLoading && (
              <>
                <LoadingSkeleton />
                <LoadingSkeleton />
              </>
            )}

            {/* Resolved References */}
            {panelState.resolvedReferences.map((reference, index) => (
              <ReferenceCard
                key={`${reference.category}-${reference.id}-${index}`}
                reference={reference}
                onClick={() => onReferenceClick(reference)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}