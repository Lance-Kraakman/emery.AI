'use client'

import React, { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronUp, Settings, RefreshCw, Eye, Search, Filter, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Badge } from '@/src/components/ui/badge'
import { ConnectionSummaryCard } from '@/src/components/ui/ConnectionSummaryCard'
import { ConnectionStatusDot } from '@/src/components/ui/ConnectionStatusBadge'
import { QuickConnectionSetup } from '@/src/components/ui/ConnectionSetupFlow'
import { getToolConnectionStatus, type ToolConnectionStatus } from '@/src/app/actions/connections'
import type { ToolDTO, ToolSearchResultDTO } from '@/src/app/mappers/tool-mapper'
import { ToolCategory } from '@/src/app/mappers/tool-mapper'
import type { ReferenceToolDTO } from '@/src/app/mappers/reference-tool-mapper'
import { searchAllTools } from '@/src/app/actions/references'
import { TOOL_CATEGORY_INFO, getCategoryInfo } from '@/src/ddd/domain/tools/value-objects/tool-metadata'
import { useSession } from 'next-auth/react'

export interface ResolvedReference {
  type: 'doc' | 'file' | 'table' | 'agent' | 'tool'
  fullPath: string
  metadata?: Record<string, any>
}

interface ToolSelectionPanelProps {
  isVisible: boolean
  onClose: () => void
  onSelectTool: (tool: ToolDTO | ReferenceToolDTO) => void
  onResolveReference?: (reference: ResolvedReference) => void
  currentOrganizationId: number
}

interface ToolCardProps {
  tool: ToolDTO | ReferenceToolDTO
  isSelected: boolean
  onToggle: () => void
  onOpenArtifact?: (tool: ToolDTO | ReferenceToolDTO) => void
  connectionStatus?: ToolConnectionStatus | null
}

type ConnectionFilter = 'all' | 'connected' | 'needs-setup';

function ToolCard({ tool, isSelected, onToggle, onOpenArtifact, connectionStatus }: ToolCardProps) {
  const isReferenceTool = 'toolName' in tool
  const displayName = isReferenceTool ? tool.displayName : tool.displayName
  const description = isReferenceTool ? tool.description : tool.description
  const toolCategory = isReferenceTool ? ToolCategory.REFERENCES : tool.category
  const requiresConnection = isReferenceTool ? tool.metadata.requiresConnection : tool.requiresConnection
  const supportsArtifacts = isReferenceTool ? tool.supportsArtifacts : false

  const categoryInfo = getCategoryInfo(toolCategory)

  const handleOpenArtifact = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenArtifact && supportsArtifacts) {
      onOpenArtifact(tool)
    }
  }

  // Get connection status tooltip
  const getConnectionTooltip = () => {
    if (!connectionStatus || connectionStatus.connectionType === 'none') {
      return 'No authentication required';
    }
    if (connectionStatus.isConnected) {
      return `Connected to: ${connectionStatus.requiredApps.join(', ')}`;
    }
    return `Needs connections: ${connectionStatus.missingApps.join(', ')}`;
  };

  return (
    <div className={`
      flex items-center gap-2 p-2 rounded-md border text-sm
      transition-colors duration-150 flex-shrink-0 max-w-xs group
      ${isSelected
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border bg-background hover:bg-muted/50'
      }
      ${connectionStatus && !connectionStatus.isConnected && connectionStatus.connectionType !== 'none' ? 'border-l-2 border-l-yellow-400' : ''}
    `}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 flex-1 min-w-0"
      >
        <span className="text-xs">{categoryInfo.icon}</span>
        <span className="truncate font-medium">
          {displayName}
        </span>
        {isSelected && <X className="h-3 w-3" />}
      </button>

      {/* Connection status indicator */}
      {connectionStatus && connectionStatus.connectionType !== 'none' && (
        <div title={getConnectionTooltip()}>
          <ConnectionStatusDot
            isConnected={connectionStatus.isConnected}
            size="sm"
          />
        </div>
      )}

      {/* Legacy connection indicator for backward compatibility */}
      {!connectionStatus && requiresConnection && (
        <div className="w-2 h-2 rounded-full bg-gray-400" title="Connection status unknown" />
      )}

      {supportsArtifacts && (
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

interface CategorySectionProps {
  category: ToolCategory
  tools: (ToolDTO | ReferenceToolDTO)[]
  selectedTools: (ToolDTO | ReferenceToolDTO)[]
  onToolSelect: (tool: ToolDTO | ReferenceToolDTO) => void
  onToolDeselect: (tool: ToolDTO | ReferenceToolDTO) => void
  onOpenArtifact?: (tool: ToolDTO | ReferenceToolDTO) => void
  getConnectionStatus?: (tool: ToolDTO | ReferenceToolDTO) => ToolConnectionStatus | null
}

function CategorySection({
  category,
  tools,
  selectedTools,
  onToolSelect,
  onToolDeselect,
  onOpenArtifact,
  getConnectionStatus
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const categoryInfo = getCategoryInfo(category)

  if (tools.length === 0) {
    return null
  }

  return (
    <div className="mb-4 last:mb-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <span>{categoryInfo.icon}</span>
        {categoryInfo.label}
        <span className="text-xs text-muted-foreground ml-1">({tools.length})</span>
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="flex flex-wrap gap-2">
          {tools.map((tool, index) => {
            const toolId = 'toolName' in tool ? `${tool.toolName}-${tool.id}` : `${tool.name}-${index}`
            const isSelected = selectedTools.some(t => {
              if ('toolName' in tool && 'toolName' in t) {
                return t.toolName === tool.toolName && t.id === tool.id
              }
              if (!('toolName' in tool) && !('toolName' in t)) {
                return t.name === tool.name
              }
              return false
            })

            return (
              <ToolCard
                key={toolId}
                tool={tool}
                isSelected={isSelected}
                onOpenArtifact={onOpenArtifact}
                connectionStatus={getConnectionStatus ? getConnectionStatus(tool) : null}
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

export default function ToolSelectionPanel({
  isVisible,
  onClose,
  onSelectTool,
  onResolveReference,
  currentOrganizationId
}: ToolSelectionPanelProps) {
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [toolData, setToolData] = useState<ToolSearchResultDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTools, setSelectedTools] = useState<(ToolDTO | ReferenceToolDTO)[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Connection status state
  const [connectionStatuses, setConnectionStatuses] = useState<ToolConnectionStatus[]>([])
  const [isLoadingConnections, setIsLoadingConnections] = useState(false)
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>('all')
  const [showConnectionSummary, setShowConnectionSummary] = useState(false)

  useEffect(() => {
    if (isVisible) {
      loadAvailableTools()
    }
  }, [isVisible])

  // Load connection status when tool data changes
  useEffect(() => {
    if (toolData && session?.user?.id) {
      loadConnectionStatus()
    }
  }, [toolData, session?.user?.id])

  const loadAvailableTools = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await searchAllTools({ query: searchQuery, limit: 50 })
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

  const loadConnectionStatus = async () => {
    if (!toolData || !session?.user?.id) return

    try {
      setIsLoadingConnections(true)

      // Combine all tools from toolData
      const allTools = [...toolData.systemTools, ...toolData.referenceTools]

      // Convert to simple tool objects for connection checking
      const simpleTools = allTools.map(tool => ({
        name: ('name' in tool ? tool.name : tool.toolName) || tool.displayName,
        displayName: tool.displayName,
        requiredApps: 'requiredApps' in tool ? tool.requiredApps || [] : []
      }))

      const result = await getToolConnectionStatus(simpleTools, session.user.id)

      if (result.success && result.data) {
        setConnectionStatuses(result.data)
      }
    } catch (error) {
      console.error('Failed to load connection status:', error)
    } finally {
      setIsLoadingConnections(false)
    }
  }

  // Reload tools when search query changes
  useEffect(() => {
    if (isVisible) {
      const timeoutId = setTimeout(() => {
        loadAvailableTools()
      }, 300) // Debounce search
      return () => clearTimeout(timeoutId)
    }
  }, [searchQuery, isVisible])

  // Helper functions
  const getConnectionStatus = (tool: ToolDTO | ReferenceToolDTO) => {
    const toolName = 'name' in tool ? tool.name : tool.toolName;
    return connectionStatuses.find(status =>
      status.toolName === toolName || status.toolName === tool.displayName
    ) || null
  }

  const filterToolsByConnection = (tools: (ToolDTO | ReferenceToolDTO)[]) => {
    if (connectionFilter === 'all') return tools

    return tools.filter(tool => {
      const status = getConnectionStatus(tool)
      if (!status || status.connectionType === 'none') return connectionFilter === 'connected'

      if (connectionFilter === 'connected') return status.isConnected
      if (connectionFilter === 'needs-setup') return !status.isConnected

      return true
    })
  }

  const getConnectionSummary = () => {
    if (connectionStatuses.length === 0) return null

    const connected = connectionStatuses.filter(s => s.isConnected || s.connectionType === 'none').length
    const needsSetup = connectionStatuses.filter(s => !s.isConnected && s.connectionType !== 'none').length
    const missingApps = [...new Set(connectionStatuses.flatMap(s => s.missingApps))]

    return { connected, total: connectionStatuses.length, needsSetup, missingApps }
  }

  const handleSetupConnection = (appName: string) => {
    window.open('/connections?setup=' + encodeURIComponent(appName), '_blank')
  }

  const handleToolSelect = (tool: ToolDTO | ReferenceToolDTO) => {
    setSelectedTools(prev => [...prev, tool])
    onSelectTool(tool)
  }

  const handleToolDeselect = (tool: ToolDTO | ReferenceToolDTO) => {
    setSelectedTools(prev => prev.filter(t => {
      if ('toolName' in tool && 'toolName' in t) {
        return !(t.toolName === tool.toolName && t.id === tool.id)
      }
      if (!('toolName' in tool) && !('toolName' in t)) {
        return t.name !== tool.name
      }
      return true
    }))
  }

  if (!isVisible) return null

  const organizeToolsByCategory = (data: ToolSearchResultDTO) => {
    const categoryMap = new Map<ToolCategory, (ToolDTO | ReferenceToolDTO)[]>()

    // Add system tools
    data.systemTools.forEach(tool => {
      const existing = categoryMap.get(tool.category) || []
      categoryMap.set(tool.category, [...existing, tool])
    })

    // Add reference tools - all reference tools go to REFERENCES category
    data.referenceTools.forEach(tool => {
      const category = ToolCategory.REFERENCES
      const existing = categoryMap.get(category) || []
      categoryMap.set(category, [...existing, tool])
    })

    return categoryMap
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l shadow-lg z-50">
      <div className="p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <h2 className="text-lg font-semibold">Tools & References</h2>
            {selectedTools.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {selectedTools.length} selected
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools and references..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Connection Summary */}
        {getConnectionSummary() && (
          <div className="mb-4">
            <ConnectionSummaryCard
              tools={connectionStatuses}
              isLoading={isLoadingConnections}
              onRefresh={loadConnectionStatus}
              onSetupConnection={handleSetupConnection}
              onViewAllConnections={() => window.open('/connections', '_blank')}
              title="Connection Status"
              className="border-0 bg-muted/20"
              collapsible={true}
              defaultExpanded={showConnectionSummary}
            />
          </div>
        )}

        {/* Connection Filters */}
        {connectionStatuses.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              {[
                { value: 'all', label: 'All', icon: null },
                { value: 'connected', label: 'Connected', icon: CheckCircle },
                { value: 'needs-setup', label: 'Need Setup', icon: XCircle }
              ].map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={connectionFilter === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConnectionFilter(value as ConnectionFilter)}
                  className="text-xs h-7"
                >
                  {Icon && <Icon className="h-3 w-3 mr-1" />}
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 justify-center py-8">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading tools...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-sm text-destructive mb-2">{error}</div>
              <Button onClick={loadAvailableTools} size="sm" variant="outline">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {toolData && !isLoading && !error && (
            <div className="space-y-4">
              {Array.from(organizeToolsByCategory(toolData)).map(([category, tools]) => {
                const filteredTools = filterToolsByConnection(tools);
                if (filteredTools.length === 0) return null;

                return (
                  <CategorySection
                    key={category}
                    category={category}
                    tools={filteredTools}
                    selectedTools={selectedTools}
                    onToolSelect={handleToolSelect}
                    onToolDeselect={handleToolDeselect}
                    onOpenArtifact={undefined}
                    getConnectionStatus={getConnectionStatus}
                  />
                );
              })}

              {toolData.systemTools.length === 0 && toolData.referenceTools.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tools or references available
                </div>
              )}

              {/* Show message when filters hide all tools */}
              {connectionFilter !== 'all' && Array.from(organizeToolsByCategory(toolData)).every(([, tools]) => filterToolsByConnection(tools).length === 0) && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tools match the selected connection filter
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConnectionFilter('all')}
                    className="ml-2"
                  >
                    Show all
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}