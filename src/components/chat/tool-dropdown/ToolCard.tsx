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
          'w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors',
          isSelected && 'bg-blue-50 border-blue-100'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Provider icon or default */}
          {app?.icon && !iconError ? (
            <div className="p-1 rounded-md flex-shrink-0 bg-white border border-gray-200">
              <img
                src={app.icon}
                alt={app.name}
                className="w-4 h-4 object-contain"
                onError={() => setIconError(true)}
              />
            </div>
          ) : (
            <div className="p-1 rounded-md flex-shrink-0 text-gray-600 bg-gray-50">
              <Icon className="w-3 h-3" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="font-medium text-sm text-gray-900 truncate">
                {displayInfo.displayName}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isMCPTool && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                    MCP
                  </span>
                )}
                {displayInfo.requiresConnection && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                    OAuth
                  </span>
                )}
                {app && !tool.type.includes('reference') && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                    {app.name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-500 line-clamp-2">
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
                        ? 'text-red-700 bg-red-50 font-semibold hover:bg-red-100'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
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
