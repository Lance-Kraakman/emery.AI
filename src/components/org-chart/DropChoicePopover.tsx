'use client';

/**
 * DropChoicePopover Component
 *
 * Popover shown at drop location when dropping an entity from EntityPalette.
 * Allows user to choose between creating a blank entity or from a template.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { File, LayoutTemplate, Bot, Sparkles, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrgChartNodeType } from './types';

interface DropChoicePopoverProps {
  isOpen: boolean;
  position: { x: number; y: number };
  entityType: OrgChartNodeType;
  onClose: () => void;
  onSelectBlank: () => void;
  onSelectTemplate: () => void;
}

function getEntityIcon(entityType: OrgChartNodeType) {
  switch (entityType) {
    case 'agent':
      return <Bot className="h-4 w-4" />;
    case 'skill':
      return <Sparkles className="h-4 w-4" />;
    case 'database':
      return <Database className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
}

function getEntityLabel(entityType: OrgChartNodeType): string {
  switch (entityType) {
    case 'agent':
      return 'Agent';
    case 'skill':
      return 'Skill';
    case 'database':
      return 'Database';
    default:
      return 'Entity';
  }
}

function getEntityColor(entityType: OrgChartNodeType): string {
  switch (entityType) {
    case 'agent':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400';
    case 'skill':
      return 'bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-400';
    case 'database':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

export function DropChoicePopover({
  isOpen,
  position,
  entityType,
  onClose,
  onSelectBlank,
  onSelectTemplate,
}: DropChoicePopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-48 bg-popover border rounded-lg shadow-xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <div className={cn('p-1 rounded', getEntityColor(entityType))}>
          {getEntityIcon(entityType)}
        </div>
        <span className="text-sm font-medium">New {getEntityLabel(entityType)}</span>
      </div>

      {/* Options */}
      <div className="p-1">
        <button
          onClick={() => {
            onSelectBlank();
            onClose();
          }}
          className={cn(
            'flex items-center gap-2 w-full p-2 rounded-md text-left',
            'hover:bg-muted transition-colors'
          )}
        >
          <div className="p-1.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <File className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Blank</p>
            <p className="text-[10px] text-muted-foreground">Start from scratch</p>
          </div>
        </button>

        <button
          onClick={() => {
            onSelectTemplate();
          }}
          className={cn(
            'flex items-center gap-2 w-full p-2 rounded-md text-left',
            'hover:bg-muted transition-colors'
          )}
        >
          <div className="p-1.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
            <LayoutTemplate className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">From Template</p>
            <p className="text-[10px] text-muted-foreground">Use a pre-built template</p>
          </div>
        </button>
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t bg-muted/50 text-[10px] text-muted-foreground">
        <span className="font-mono">esc</span> to cancel
      </div>
    </div>
  );
}

export default DropChoicePopover;
