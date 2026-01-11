'use client';

/**
 * StickyNode - Simple canvas annotation note
 *
 * Plain textarea with S/M/L text size options.
 */

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { NodeResizer, useNodeId } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { StickyNodeData } from '../types';
import { useStickyNoteContext } from '@/components/shared/StickyNoteContext';

interface StickyNodeProps {
  data: StickyNodeData;
  selected: boolean;
}

const colorClasses = {
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
  blue: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
  green: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
  pink: 'bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700',
  purple: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-base',
  lg: 'text-xl',
};

export const StickyNode = memo(function StickyNode({
  data,
  selected,
}: StickyNodeProps) {
  const nodeId = useNodeId();
  const context = useStickyNoteContext();
  const color = data.color || 'yellow';
  const textSize = data.textSize || 'md';
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync content when data changes externally
  useEffect(() => {
    if (!isEditing) {
      setContent(data.content || '');
    }
  }, [data.content, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!context) return;
    e.stopPropagation();
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [context]);

  const handleBlur = useCallback(() => {
    if (nodeId && context) {
      context.updateNote(nodeId, { content });
    }
    setIsEditing(false);
  }, [nodeId, context, content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (nodeId && context) {
        context.updateNote(nodeId, { content });
      }
      setIsEditing(false);
    }
    // Stop propagation for all keys when editing to prevent React Flow shortcuts
    e.stopPropagation();
  }, [nodeId, context, content]);

  const handleSizeChange = useCallback((size: 'sm' | 'md' | 'lg') => {
    if (nodeId && context) {
      context.updateNote(nodeId, { textSize: size });
    }
  }, [nodeId, context]);

  // Stop mouse events from bubbling to React Flow when editing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
    }
  }, [isEditing]);

  return (
    <>
      <NodeResizer
        minWidth={120}
        minHeight={80}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!w-2 !h-2 !bg-primary !border-primary"
      />
      <div
        className={cn(
          'min-w-[120px] min-h-[80px] w-full h-full rounded-lg border-2 shadow-md flex flex-col',
          colorClasses[color],
          selected && 'ring-2 ring-primary ring-offset-2',
          context && 'cursor-text'
        )}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onPointerDown={handleMouseDown}
      >
        {/* Size toolbar - always visible when selected */}
        {selected && context && (
          <div className="flex items-center justify-end gap-0.5 p-1 border-b border-inherit bg-black/5 dark:bg-white/5 rounded-t-md">
            {(['sm', 'md', 'lg'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleSizeChange(size)}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  'px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors',
                  'hover:bg-black/10 dark:hover:bg-white/10',
                  textSize === size && 'bg-black/15 dark:bg-white/15'
                )}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 p-3 overflow-auto">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full h-full resize-none bg-transparent outline-none text-foreground/80',
                textSizeClasses[textSize]
              )}
              placeholder="Type your note..."
            />
          ) : (
            <div
              className={cn(
                'whitespace-pre-wrap text-foreground/80',
                textSizeClasses[textSize]
              )}
            >
              {content || (context ? 'Double-click to edit...' : '')}
            </div>
          )}
        </div>
      </div>
    </>
  );
});
