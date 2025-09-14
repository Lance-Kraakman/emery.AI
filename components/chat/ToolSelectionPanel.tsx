'use client'

import React, { useState, useEffect } from 'react'
import { FileText, File, Database, Users, Plus, X, ChevronDown, ChevronUp, Settings, Zap, BarChart, ExternalLink, Eye, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createDocumentArtifact, createFileArtifact } from './types/chat-artifacts'
import { getAvailableTools, validateToolSelection } from '@/app/actions/tools'
import type { ToolDTO, ToolCategoryDTO, ToolSelectionDTO } from '@/app/mappers/tool-mapper'
// Legacy interface maintained for backward compatibility during migration
export interface ResolvedReference {
  type: 'doc' | 'file' | 'table' | 'agent' | 'tool'
  fullPath: string
  originalMatch: string
  startIndex: number
  endIndex: number
  data?: any
  metadata?: {
    title?: string
    description?: string
    content?: string
    size?: number
    mimeType?: string
    wordCount?: number
    error?: string
  }
}

// Using proper DTOs from mapper
type ToolCategory = ToolCategoryDTO

interface ToolSelectionPanelProps {
  selectedTools: ToolDTO[]
  onToolSelect: (tool: ToolDTO) => void
  onToolDeselect: (tool: ToolDTO) => void
  onOpenArtifact?: (artifact: any) => void // For opening doc/file artifacts
  className?: string
}

interface ToolCardProps {
  tool: ToolDTO
  isSelected: boolean
  onToggle: () => void
  onOpenArtifact?: (artifact: any) => void
}

function ToolCard({ tool, isSelected, onToggle, onOpenArtifact }: ToolCardProps) {
  // Determine icon based on tool type from DTO
  const getIcon = () => {
    switch (tool.type) {
      case 'document':
        return <FileText className="h-4 w-4 text-blue-600" />
      case 'file':
        return <File className="h-4 w-4 text-green-600" />
      case 'table':
        return <Database className="h-4 w-4 text-purple-600" />
      case 'agent':
        return <Users className="h-4 w-4 text-orange-600" />
      case 'oauth_app':
        return <Users className="h-4 w-4 text-orange-600" />
      case 'webhook':
        return <Zap className="h-4 w-4 text-purple-600" />
      case 'utility':
        return <BarChart className="h-4 w-4 text-gray-600" />
      default:
        return <Zap className="h-4 w-4 text-gray-600" />
    }
  }

  // Get display name from tool DTO
  const getDisplayName = () => {
    return tool.title
  }

  // Handle opening artifact
  const handleOpenArtifact = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenArtifact && tool.canOpenArtifact) {
      try {
        // Create appropriate artifact based on tool type
        if (tool.type === 'document') {
          // Create document artifact from tool config
          const artifact = createDocumentArtifact(
            tool.config as any, // DocumentFieldValue
            parseInt(tool.config.tableId || '0'),
            parseInt(tool.config.fieldId || '0'),
            'view',
            tool.config.fileUrl
          )
          onOpenArtifact(artifact)
        } else if (tool.type === 'file') {
          // Create file artifact from tool config
          const artifact = createFileArtifact(
            tool.config as any, // FileFieldValue
            parseInt(tool.config.tableId || '0'),
            parseInt(tool.config.fieldId || '0'),
            'pdf', // TODO: Detect actual viewer type
            tool.config.fileUrl || ''
          )
          onOpenArtifact(artifact)
        }
      } catch (error) {
        console.error('Failed to create artifact:', error)
      }
    }
  }

  return (
    <div className={`
      flex items-center gap-2 p-2 rounded-md border text-sm
      transition-colors duration-150 flex-shrink-0 max-w-xs group
      ${isSelected
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border bg-background hover:bg-muted/50'
      }
    `}>
      {/* Main tool info - clickable to select */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 flex-1 min-w-0"
      >
        {getIcon()}
        <span className="truncate font-medium">
          {getDisplayName()}
        </span>
        {isSelected && <X className="h-3 w-3" />}
      </button>

      {/* Connection status indicator */}
      {tool.requiresConnection && (
        <div className={`w-2 h-2 rounded-full ${
          tool.connectionStatus === 'connected' ? 'bg-green-500' :
          tool.connectionStatus === 'error' ? 'bg-red-500' :
          'bg-yellow-500'
        }`} title={`Connection: ${tool.connectionStatus || 'unknown'}`} />
      )}

      {/* Artifact open button - only for doc/file references */}
      {tool.canOpenArtifact && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenArtifact}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Open in viewer"
        >
          <Eye className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

function CategorySection({
  category,
  selectedTools,
  onToolSelect,
  onToolDeselect,
  onOpenArtifact
}: {
  category: ToolCategory
  selectedTools: ToolDTO[]
  onToolSelect: (tool: ToolDTO) => void
  onToolDeselect: (tool: ToolDTO) => void
  onOpenArtifact?: (artifact: any) => void
}) {
  const [isExpanded, setIsExpanded] = useState(category.expanded !== false)

  if (category.tools.length === 0) {
    return null
  }

  return (
    <div className="mb-4 last:mb-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        {getCategoryIcon(category.icon)}
        {category.label}
        <span className="text-xs text-muted-foreground ml-1">({category.tools.length})</span>
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="flex flex-wrap gap-2">
          {category.tools.map((tool, index) => {
            const isSelected = selectedTools.some(t => t.id === tool.id)

            return (
              <ToolCard
                key={`${tool.id}-${index}`}
                tool={tool}
                isSelected={isSelected}
                onOpenArtifact={onOpenArtifact}
                onToggle={() => {
                  if (isSelected) {
                    onToolDeselect(tool)
                  } else {
                    onToolSelect(tool)
                  }
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ToolSelectionPanel({
  selectedTools,
  onToolSelect,
  onToolDeselect,
  onOpenArtifact,
  className = ""
}: ToolSelectionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [toolData, setToolData] = useState<ToolSelectionDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load available tools on mount
  useEffect(() => {
    loadAvailableTools()
  }, [])

  const loadAvailableTools = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await getAvailableTools()
      if (result.success && result.data) {
        setToolData(result.data)
      } else {
        setError(result.error || 'Failed to load tools')
      }
    } catch (err) {
      console.error('Error loading tools:', err)
      setError('Failed to load tools')
    } finally {
      setIsLoading(false)
    }
  }

  // Don't render if loading or no tools available
  if (isLoading) {
    return (
      <div className={`border-t border-border bg-muted/10 ${className}`}>
        <div className="px-4 py-3 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading tools...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`border-t border-border bg-muted/10 ${className}`}>
        <div className="px-4 py-3">
          <div className="text-sm text-destructive mb-2">{error}</div>
          <Button onClick={loadAvailableTools} size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!toolData || toolData.availableCategories.every(cat => cat.tools.length === 0)) {
    return null
  }

  const totalSelectedCount = selectedTools.length

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
              <Settings className="h-3 w-3" />
              Tools & References
              {isCollapsed ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {totalSelectedCount > 0 && (
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {totalSelectedCount} selected
              </span>
            )}
          </div>
        </div>

        {/* Tool Categories */}
        {!isCollapsed && (
          <div className="space-y-4">
            {toolData.availableCategories.map((category, index) => (
              <CategorySection
                key={`${category.name}-${index}`}
                category={category}
                selectedTools={selectedTools}
                onToolSelect={onToolSelect}
                onToolDeselect={onToolDeselect}
                onOpenArtifact={onOpenArtifact}
              />
            ))}

            {toolData.availableCategories.every(cat => cat.tools.length === 0) && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No tools or references available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to get React icon component from string identifier
function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ReactNode> = {
    Database: <Database className="h-3 w-3" />,
    Users: <Users className="h-3 w-3" />,
    BarChart: <BarChart className="h-3 w-3" />,
    Zap: <Zap className="h-3 w-3" />,
    Settings: <Settings className="h-3 w-3" />
  }
  return icons[iconName] || <Settings className="h-3 w-3" />
}

// Utility function to convert ResolvedReference to ToolDTO for compatibility
export function createReferenceToolCategory(references: ResolvedReference[]): ToolCategory {
  const tools: ToolDTO[] = references
    .filter(ref => !ref.metadata?.error) // Only include valid references
    .map(ref => ({
      id: `${ref.type}-${ref.data?.id || Math.random()}`,
      name: ref.type === 'doc' ? 'document_reader' :
            ref.type === 'file' ? 'file_reader' :
            ref.type === 'table' ? 'table_reader' :
            ref.type === 'agent' ? 'agent_reader' : 'reference_reader',
      version: '1.0',
      title: ref.data?.name || ref.data?.documentMetadata?.title || ref.originalMatch,
      description: `${ref.type} reference`,
      category: 'references' as const,
      type: ref.type as any,
      requiresConnection: false,
      canOpenArtifact: ref.type === 'doc' || ref.type === 'file',
      config: {
        title: ref.data?.name || ref.data?.documentMetadata?.title || ref.originalMatch,
        type: ref.type,
        id: ref.data?.id?.toString() || ref.originalMatch,
        reference_id: ref.data?.id?.toString(),
        original_match: ref.originalMatch,
        ...ref.data
      }
    }))

  return {
    name: 'references',
    label: 'References',
    icon: 'Database',
    description: 'Documents and files from your data',
    tools,
    expanded: true
  }
}