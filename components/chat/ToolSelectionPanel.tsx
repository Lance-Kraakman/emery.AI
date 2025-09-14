'use client'

import React, { useState } from 'react'
import { FileText, File, Database, Users, Plus, X, ChevronDown, ChevronUp, Settings, Zap, BarChart, ExternalLink, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config'
import { createDocumentArtifact, createFileArtifact } from './types/chat-artifacts'
// Reference types for backward compatibility (simplified from old reference-resolver)
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

interface ToolCategory {
  name: 'references' | 'apps' | 'utilities'
  label: string
  icon: React.ReactNode
  tools: ToolConfig[]
}

interface ToolSelectionPanelProps {
  availableTools: ToolCategory[]
  selectedTools: ToolConfig[]
  onToolSelect: (tool: ToolConfig) => void
  onToolDeselect: (tool: ToolConfig) => void
  onOpenArtifact?: (artifact: any) => void // For opening doc/file artifacts
  className?: string
}

interface ToolCardProps {
  tool: ToolConfig
  isSelected: boolean
  onToggle: () => void
  onOpenArtifact?: (artifact: any) => void
  canOpenArtifact: boolean
}

function ToolCard({ tool, isSelected, onToggle, onOpenArtifact, canOpenArtifact }: ToolCardProps) {
  // Determine icon based on tool name/type
  const getIcon = () => {
    if (tool.name.includes('document') || tool.name.includes('doc')) {
      return <FileText className="h-4 w-4 text-blue-600" />
    }
    if (tool.name.includes('file')) {
      return <File className="h-4 w-4 text-green-600" />
    }
    if (tool.name.includes('table') || tool.name.includes('data')) {
      return <Database className="h-4 w-4 text-purple-600" />
    }
    if (tool.name.includes('slack') || tool.name.includes('teams')) {
      return <Users className="h-4 w-4 text-orange-600" />
    }
    return <Zap className="h-4 w-4 text-gray-600" />
  }

  // Get display name from tool config
  const getDisplayName = () => {
    return tool.config.title || tool.config.name || tool.name
  }

  // Handle opening artifact
  const handleOpenArtifact = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenArtifact && canOpenArtifact) {
      try {
        // Create appropriate artifact based on tool type
        if (tool.name.includes('document') || tool.name.includes('doc')) {
          // Create document artifact from tool config
          const artifact = createDocumentArtifact(
            tool.config as any, // DocumentFieldValue
            parseInt(tool.config.tableId || '0'),
            parseInt(tool.config.fieldId || '0'),
            'view',
            tool.config.fileUrl
          )
          onOpenArtifact(artifact)
        } else if (tool.name.includes('file')) {
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

      {/* Artifact open button - only for doc/file references */}
      {canOpenArtifact && (
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
  selectedTools: ToolConfig[]
  onToolSelect: (tool: ToolConfig) => void
  onToolDeselect: (tool: ToolConfig) => void
  onOpenArtifact?: (artifact: any) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (category.tools.length === 0) {
    return null
  }

  return (
    <div className="mb-4 last:mb-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        {category.icon}
        {category.label}
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="flex flex-wrap gap-2">
          {category.tools.map((tool, index) => {
            const isSelected = selectedTools.some(t => t.name === tool.name)
            const canOpenArtifact = tool.config.type === 'document' || tool.config.type === 'file'

            return (
              <ToolCard
                key={`${tool.name}-${index}`}
                tool={tool}
                isSelected={isSelected}
                canOpenArtifact={canOpenArtifact}
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
  availableTools,
  selectedTools,
  onToolSelect,
  onToolDeselect,
  onOpenArtifact,
  className = ""
}: ToolSelectionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Don't render if no tools available
  if (availableTools.every(cat => cat.tools.length === 0)) {
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
            {availableTools.map((category, index) => (
              <CategorySection
                key={`${category.name}-${index}`}
                category={category}
                selectedTools={selectedTools}
                onToolSelect={onToolSelect}
                onToolDeselect={onToolDeselect}
                onOpenArtifact={onOpenArtifact}
              />
            ))}

            {availableTools.every(cat => cat.tools.length === 0) && (
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

// Utility function to convert ResolvedReference to ToolConfig for compatibility
export function createReferenceToolCategory(references: ResolvedReference[]): ToolCategory {
  return {
    name: 'references',
    label: 'References',
    icon: <Database className="h-3 w-3" />,
    tools: references
      .filter(ref => !ref.metadata?.error) // Only include valid references
      .map(ref => ({
        name: ref.type === 'doc' ? 'document_reader' :
              ref.type === 'file' ? 'file_reader' :
              ref.type === 'table' ? 'table_reader' :
              ref.type === 'agent' ? 'agent_reader' : 'reference_reader',
        version: '1.0',
        config: {
          title: ref.data?.name || ref.data?.documentMetadata?.title || ref.originalMatch,
          type: ref.type,
          id: ref.data?.id?.toString() || ref.originalMatch,
          reference_id: ref.data?.id?.toString(),
          original_match: ref.originalMatch,
          // Include metadata for artifact generation
          ...ref.data
        }
      })) as ToolConfig[]
  }
}

// Utility to create sample tool categories (for development/testing)
export function createSampleToolCategories(): ToolCategory[] {
  return [
    {
      name: 'references',
      label: 'References',
      icon: <Database className="h-3 w-3" />,
      tools: [
        {
          name: 'document_reader',
          version: '1.0',
          config: { title: 'Sales Report Q4', type: 'document', id: 'doc_1' }
        },
        {
          name: 'file_reader',
          version: '1.0',
          config: { title: 'Analysis.pdf', type: 'file', id: 'file_1' }
        }
      ] as ToolConfig[]
    },
    {
      name: 'apps',
      label: 'Apps',
      icon: <Users className="h-3 w-3" />,
      tools: [
        {
          name: 'slack_send_message',
          version: '1.0',
          config: { title: 'Send Slack Message', app: 'slack' }
        },
        {
          name: 'pipedream_webhook',
          version: '1.0',
          config: { title: 'Trigger Webhook', app: 'pipedream' }
        }
      ] as ToolConfig[]
    },
    {
      name: 'utilities',
      label: 'Utilities',
      icon: <BarChart className="h-3 w-3" />,
      tools: [
        {
          name: 'data_analyzer',
          version: '1.0',
          config: { title: 'Analyze Data', type: 'utility' }
        },
        {
          name: 'report_generator',
          version: '1.0',
          config: { title: 'Generate Report', type: 'utility' }
        }
      ] as ToolConfig[]
    }
  ]
}