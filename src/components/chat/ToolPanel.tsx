'use client'

/**
 * Tool Panel Component
 *
 * Always-visible panel showing selected tools from chat.
 * Supports artifact opening for doc/file tools and remove functionality.
 * Enhanced with connection status indicators and setup flows.
 */

import React, { useState, useEffect } from 'react'
import { FileText, File, Database, Users, Plus, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectionStatusDot } from '@/components/ui/ConnectionStatusBadge'
import { ConnectionSummaryCard } from '@/components/ui/ConnectionSummaryCard'
import { QuickConnectionSetup } from '@/components/ui/ConnectionSetupFlow'
import { getToolConnectionStatus, type ToolConnectionStatus } from '@/app/actions/connections'
import type { ToolDTO } from '@/app/mappers/tool-mapper'
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata'
import { useSession } from 'next-auth/react'

interface ToolPanelProps {
  tools?: ToolDTO[] // Selected tools
  onToolClick: (tool: ToolDTO) => void // Handle tool click (artifact opening, etc.)
  onAddTool?: () => void // Trigger @ dropdown for adding tools
  onRemoveTool?: (tool: ToolDTO) => void // Remove tool from selection
  isLoading?: boolean
  className?: string
  showConnectionStatus?: boolean // Show connection status indicators
}

interface ToolCardProps {
  tool: ToolDTO
  onClick: () => void
  onRemove?: () => void
  connectionStatus?: ToolConnectionStatus | null
}

function ToolCard({ tool, onClick, onRemove, connectionStatus }: ToolCardProps) {
  const isReferenceTool = tool.type === 'reference';

  // Determine icon based on tool category
  const getIcon = () => {
    if (isReferenceTool) {
      switch (tool.category) {
        case ToolCategory.DOCUMENTS:
          return <FileText className="h-3.5 w-3.5 text-blue-600" />
        case ToolCategory.FILES:
          return <File className="h-3.5 w-3.5 text-green-600" />
        case ToolCategory.TABLES:
          return <Database className="h-3.5 w-3.5 text-purple-600" />
        case ToolCategory.AGENTS:
          return <Users className="h-3.5 w-3.5 text-orange-600" />
        case ToolCategory.DATABASES:
          return <Database className="h-3.5 w-3.5 text-gray-600" />
        default:
          return <FileText className="h-3.5 w-3.5 text-gray-600" />
      }
    } else {
      // System tool icons - use generic icons for now
      return <Plus className="h-3.5 w-3.5 text-gray-600" />
    }
  }

  // Get display name from DTO
  const getDisplayName = () => {
    return tool.displayName
  }

  // Check if tool can be opened as artifact
  const canOpenArtifact = isReferenceTool && tool.supportsArtifacts

  // Build tooltip with connection info
  const getTooltip = () => {
    let tooltip = tool.description;
    if (canOpenArtifact) {
      tooltip += ' (Click to view)';
    }
    if (connectionStatus && connectionStatus.connectionType !== 'none') {
      if (connectionStatus.isConnected) {
        tooltip += ` • Connected to: ${connectionStatus.requiredApps.join(', ')}`;
      } else {
        tooltip += ` • Needs connections: ${connectionStatus.missingApps.join(', ')}`;
      }
    }
    return tooltip;
  };

  return (
    <div className="relative flex items-center group">
      <button
        onClick={onClick}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs
          transition-colors duration-150 flex-shrink-0 max-w-xs
          border-border bg-background hover:bg-muted/50 cursor-pointer
          ${canOpenArtifact ? 'hover:border-blue-300' : ''}
          ${connectionStatus && !connectionStatus.isConnected && connectionStatus.connectionType !== 'none' ? 'border-yellow-200' : ''}
        `}
        title={getTooltip()}
      >
        {getIcon()}
        <span className="truncate font-medium">
          {getDisplayName()}
        </span>

        {/* Connection status indicator */}
        {connectionStatus && connectionStatus.connectionType !== 'none' && (
          <ConnectionStatusDot
            isConnected={connectionStatus.isConnected}
            size="sm"
            className="ml-1"
          />
        )}

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
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background animate-pulse">
      <div className="h-3.5 w-3.5 bg-muted rounded" />
      <div className="h-3 w-20 bg-muted rounded" />
    </div>
  )
}

export function ToolPanel({
  tools = [],
  onToolClick,
  onAddTool,
  onRemoveTool,
  isLoading = false,
  className = "",
  showConnectionStatus = true
}: ToolPanelProps) {
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showConnectionSummary, setShowConnectionSummary] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState<ToolConnectionStatus[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);

  // Load connection status when tools change
  useEffect(() => {
    if (showConnectionStatus && tools.length > 0 && session?.user?.id) {
      loadConnectionStatus();
    } else {
      setConnectionStatuses([]);
    }
  }, [tools, showConnectionStatus, session?.user?.id]);

  const loadConnectionStatus = async () => {
    try {
      setIsLoadingConnections(true);

      // Convert DTOs to simple tool objects for connection checking
      const simpleTools = tools.map(tool => ({
        name: tool.name || tool.displayName,
        displayName: tool.displayName,
        requiredApps: tool.requiredApps || []
      }));

      const result = await getToolConnectionStatus(simpleTools, session?.user?.id);

      if (result.success && result.data) {
        setConnectionStatuses(result.data);
      }
    } catch (error) {
      console.error('Failed to load connection status:', error);
    } finally {
      setIsLoadingConnections(false);
    }
  };

  // Find connection status for a specific tool
  const getConnectionStatus = (tool: ToolDTO) => {
    const toolName = tool.name;
    return connectionStatuses.find(status =>
      status.toolName === toolName || status.toolName === tool.displayName
    ) || null;
  };

  // Calculate connection summary
  const connectionSummary = (connectionStatuses || []).length > 0 ? {
    connected: (connectionStatuses || []).filter(s => s.isConnected || s.connectionType === 'none').length,
    total: (connectionStatuses || []).length,
    needsConnection: (connectionStatuses || []).filter(s => !s.isConnected && s.connectionType !== 'none').length,
    missingApps: [...new Set((connectionStatuses || []).flatMap(s => s.missingApps))]
  } : null;

  const handleSetupConnection = (appName: string) => {
    // This would open the connection setup flow
    console.log('Setup connection for:', appName);
    // For now, redirect to connections page
    window.open('/connections?setup=' + encodeURIComponent(appName), '_blank');
  };

  return (
    <div className={`border-t border-border bg-muted/10 ${className}`}>
      <div className="py-1.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
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

            {/* Connection status indicator */}
            {showConnectionStatus && connectionSummary && connectionSummary.needsConnection > 0 && (
              <button
                onClick={() => setShowConnectionSummary(!showConnectionSummary)}
                className="text-xs text-yellow-600 hover:text-yellow-700"
                title={`${connectionSummary.needsConnection} tools need connections`}
              >
                ⚠ {connectionSummary.needsConnection}
              </button>
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

        {/* Connection Summary */}
        {showConnectionStatus && showConnectionSummary && connectionSummary && (
          <div className="mb-1.5">
            <ConnectionSummaryCard
              tools={connectionStatuses}
              isLoading={isLoadingConnections}
              onRefresh={loadConnectionStatus}
              onSetupConnection={handleSetupConnection}
              title="Connection Status"
              collapsible={false}
              className="border-0 bg-muted/50"
            />
          </div>
        )}

        {/* Tools */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Loading State */}
            {isLoading && (
              <>
                <LoadingSkeleton />
                <LoadingSkeleton />
              </>
            )}

            {/* Selected Tools */}
            {tools.length > 0 ? (
              tools.map((toolDTO, index) => {
                // Create type-safe key for both tool types
                const toolKey = 'toolName' in toolDTO ? toolDTO.id : toolDTO.name;
                const connectionStatus = showConnectionStatus ? getConnectionStatus(toolDTO) : null;

                return (
                  <ToolCard
                    key={`${toolDTO.category}-${toolKey}-${index}`}
                    tool={toolDTO}
                    onClick={() => onToolClick(toolDTO)}
                    onRemove={onRemoveTool ? () => onRemoveTool(toolDTO) : undefined}
                    connectionStatus={connectionStatus}
                  />
                );
              })
            ) : !isLoading ? (
              /* Empty State with Helpful Hint */
              <div className="text-xs text-muted-foreground py-1">
                Type @ to add tools, documents, agents, and more
              </div>
            ) : null}

            {/* Setup missing connections shortcut */}
            {showConnectionStatus && connectionSummary && connectionSummary.needsConnection > 0 && (
              <div className="flex-shrink-0">
                <QuickConnectionSetup
                  appName={connectionSummary.missingApps[0]}
                  onSuccess={loadConnectionStatus}
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs border-dashed border-yellow-300 text-yellow-700 hover:border-yellow-400"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Setup ({connectionSummary.needsConnection})
                </QuickConnectionSetup>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}