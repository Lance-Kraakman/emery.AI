import React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import { getToolInsertTextWithParameters } from './utils';

type App = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
};

interface ToolCardProps {
  tool: ToolDTO;
  index: number;
  isSelected: boolean;
  onSelect: (tool: ToolDTO) => void;
  onMouseEnter: () => void;
  availableApps: App[];
}

/**
 * Individual tool card display
 */
export function ToolCard({ tool, index, isSelected, onSelect, onMouseEnter, availableApps }: ToolCardProps) {
  try {
    const [iconError, setIconError] = React.useState(false);
    const params = tool.config.parameters;
    const paramEntries = Object.entries(params);

    const displayInfo = {
      displayName: tool.displayName,
      description: tool.description,
      insertText: getToolInsertTextWithParameters(tool),
      requiresConnection: tool.requiresConnection,
    };

    // Find the app for this tool
    const appName = tool.requiredApps?.[0];
    const app = appName ? availableApps.find(a => a.id === appName || a.name === appName) : null;

    // Detect MCP tools by app name
    const isMCPTool = appName?.toLowerCase().includes('mcp') || false;

    // Use tool icon or default
    const Icon = FileText; // Default icon for now

    const toolId = `tool-${tool.name}-${index}`;

    return (
      <button
        key={toolId}
        data-tool-item-index={index}
        onClick={() => onSelect({ ...tool, insertText: displayInfo.insertText })}
        onMouseEnter={onMouseEnter}
        className={cn(
          'w-full px-4 py-3 text-left hover:bg-accent border-b border-border/50 last:border-b-0 transition-colors',
          isSelected && 'bg-accent'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Provider icon or default */}
          {app?.icon && !iconError ? (
            <div className="p-1 rounded-md flex-shrink-0 bg-background border border-border">
              <img
                src={app.icon}
                alt={app.name}
                className="w-4 h-4 object-contain"
                onError={() => setIconError(true)}
              />
            </div>
          ) : (
            <div className="p-1 rounded-md flex-shrink-0 text-muted-foreground bg-muted">
              <Icon className="w-3 h-3" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="font-medium text-sm text-foreground truncate">
                {displayInfo.displayName}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isMCPTool && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
                    MCP
                  </span>
                )}
                {displayInfo.requiresConnection && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">
                    OAuth
                  </span>
                )}
                {app && !tool.type.includes('reference') && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    {app.name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {displayInfo.description}
            </div>

            {/* Parameter display */}
            {paramEntries.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {paramEntries.map(([name, param]) => (
                  <span
                    key={name}
                    title={`${param.type}${param.description ? ': ' + param.description : ''}`}
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded cursor-help transition-colors',
                      param.required
                        ? 'text-red-400 bg-red-500/20 font-semibold hover:bg-red-500/30'
                        : 'text-muted-foreground bg-muted hover:bg-accent'
                    )}
                  >
                    {name}{param.required ? '*' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </button>
    );
  } catch (error) {
    console.error('[ToolCard] Error rendering tool:', error, tool);
    return (
      <div className="px-4 py-3 text-xs text-red-500">
        Error rendering tool
      </div>
    );
  }
}
