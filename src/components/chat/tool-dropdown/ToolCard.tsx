import React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import { getToolInsertTextWithParameters } from './utils';

interface ToolCardProps {
  tool: ToolDTO;
  index: number;
  isSelected: boolean;
  onSelect: (tool: ToolDTO) => void;
  onMouseEnter: () => void;
}

/**
 * Individual tool card display
 */
export function ToolCard({ tool, index, isSelected, onSelect, onMouseEnter }: ToolCardProps) {
  try {
    const params = tool.config.parameters;
    const paramEntries = Object.entries(params);

    const displayInfo = {
      displayName: tool.displayName,
      description: tool.description,
      insertText: getToolInsertTextWithParameters(tool),
      requiresConnection: tool.requiresConnection,
    };

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
          <div className="p-1 rounded-md flex-shrink-0 text-gray-600 bg-gray-50">
            <Icon className="w-3 h-3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm text-gray-900 truncate">
                {displayInfo.displayName}
              </div>
              {displayInfo.requiresConnection && (
                <span className="text-xs text-orange-500 whitespace-nowrap flex-shrink-0">
                  Requires OAuth connection
                </span>
              )}
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
