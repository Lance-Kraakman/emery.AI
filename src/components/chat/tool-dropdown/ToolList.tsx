import React, { useRef, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import { ToolCard } from './ToolCard';

interface ToolListProps {
  tools: ToolDTO[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  onLoadMore: () => void;
  onSelectTool: (tool: ToolDTO) => void;
  query: string;
}

/**
 * Tool results list with infinite scroll
 */
export function ToolList({
  tools,
  hasMore,
  isLoading,
  isLoadingMore,
  error,
  onLoadMore,
  onSelectTool,
  query,
}: ToolListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Scroll detection for infinite scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    // Trigger load more when within 100px of bottom
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 100;

    if (nearBottom && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-gray-500">Searching tools...</span>
        </div>
      ) : error ? (
        <div className="p-4 text-center text-sm text-red-600">
          Failed to load tools. Please try again.
        </div>
      ) : tools.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-500">
          {query.trim() ? 'No tools found' : 'Type to search tools'}
        </div>
      ) : (
        <>
          {tools.map((tool, index) => (
            <ToolCard
              key={`${tool.name}-${index}`}
              tool={tool}
              index={index}
              isSelected={index === selectedIndex}
              onSelect={onSelectTool}
              onMouseEnter={() => setSelectedIndex(index)}
            />
          ))}

          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="flex items-center justify-center p-4 border-t border-gray-100">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-gray-500">Loading more tools...</span>
            </div>
          )}

          {/* Scroll for more indicator */}
          {hasMore && !isLoadingMore && tools.length >= 20 && (
            <div className="p-2 text-center text-xs text-gray-400 border-t border-gray-100">
              {tools.length} tools • Scroll for more
            </div>
          )}
        </>
      )}
    </div>
  );
}
