'use client'

import React, { useState } from 'react'
import { FileText, File, Database, Users, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ResolvedReference } from '@/lib/chat/reference-resolver'

interface ReferencesPanelProps {
  resolvedReferences: ResolvedReference[]
  onReferenceClick: (reference: ResolvedReference) => void
  isLoading?: boolean
  className?: string
}

interface ReferenceCardProps {
  reference: ResolvedReference
  onClick: () => void
}

function ReferenceCard({ reference, onClick }: ReferenceCardProps) {
  // Determine icon based on reference type
  const getIcon = () => {
    switch (reference.type) {
      case 'doc':
        return <FileText className="h-4 w-4 text-blue-600" />
      case 'file':
        return <File className="h-4 w-4 text-green-600" />
      case 'table':
        return <Database className="h-4 w-4 text-purple-600" />
      case 'agent':
        return <Users className="h-4 w-4 text-orange-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  // Get display name
  const getDisplayName = () => {
    if (reference.metadata?.error) {
      return `${reference.originalMatch} (not found)`
    }
    
    if (reference.type === 'doc' && reference.data) {
      return reference.data.documentMetadata?.title || reference.data.name
    }
    
    if (reference.type === 'file' && reference.data) {
      return reference.data.name
    }
    
    // Fallback to fullPath or originalMatch
    return reference.fullPath || reference.originalMatch.replace(/^@\w+:/, '')
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
  resolvedReferences, 
  onReferenceClick, 
  isLoading = false,
  className = "" 
}: ReferencesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (!isLoading && resolvedReferences.length === 0) {
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
            {!isLoading && resolvedReferences.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {resolvedReferences.length}
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
            {isLoading && (
              <>
                <LoadingSkeleton />
                <LoadingSkeleton />
              </>
            )}
            
            {resolvedReferences.map((reference, index) => (
              <ReferenceCard
                key={`${reference.type}-${reference.originalMatch}-${index}`}
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