'use client';

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
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

/**
 * StickyNode - Canvas annotation note
 * Supports inline editing when wrapped in StickyNoteProvider.
 * Purely for documentation, does not participate in workflow execution.
 */
export const StickyNode = memo(function StickyNode({
  data,
  selected,
}: StickyNodeProps) {
  const nodeId = useNodeId();
  const context = useStickyNoteContext();
  const color = data.color || 'yellow';

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(data.name);
  const [editContent, setEditContent] = useState(data.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local state when data changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditName(data.name);
      setEditContent(data.content);
    }
  }, [data.name, data.content, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!context) return; // No editing without context
    e.stopPropagation();
    setIsEditing(true);
  }, [context]);

  const handleSave = useCallback(() => {
    if (nodeId && context) {
      context.updateNote(nodeId, {
        name: editName,
        content: editContent,
      });
    }
    setIsEditing(false);
  }, [nodeId, editName, editContent, context]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Revert changes
      setEditName(data.name);
      setEditContent(data.content);
      setIsEditing(false);
    }
  }, [data.name, data.content]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
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
          'min-w-[120px] min-h-[80px] w-full h-full rounded-lg border-2 p-3 shadow-md',
          colorClasses[color],
          selected && 'ring-2 ring-primary ring-offset-2',
          context && 'cursor-text'
        )}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <div className="flex flex-col h-full gap-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Note title..."
              className="w-full bg-transparent border-none outline-none font-semibold text-sm text-foreground/80 placeholder:text-foreground/40"
            />
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              placeholder="Type your note here..."
              className="flex-1 w-full bg-transparent border-none outline-none resize-none text-xs text-foreground/70 placeholder:text-foreground/40"
            />
          </div>
        ) : (
          <>
            {data.name && (
              <div className="font-semibold text-sm mb-1 text-foreground/80">
                {data.name}
              </div>
            )}
            <div className="text-xs text-foreground/70 whitespace-pre-wrap">
              {data.content || (context ? 'Double-click to edit...' : '')}
            </div>
          </>
        )}
      </div>
    </>
  );
});
