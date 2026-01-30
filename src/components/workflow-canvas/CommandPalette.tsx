'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Copy,
  Clipboard,
  Undo,
  Redo,
  Trash2,
  Maximize2,
  Target,
  ToggleLeft,
  StickyNote,
  SquareDashed,
  XCircle,
  CopyPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  keywords: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  // Action handlers
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onFitView: () => void;
  onCenterSelected: () => void;
  onToggleDisabled: () => void;
  onAddStickyNote: () => void;
  // State for disabling actions
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export function CommandPalette({
  isOpen,
  position,
  onClose,
  onCopy,
  onPaste,
  onDuplicate,
  onUndo,
  onRedo,
  onDelete,
  onSelectAll,
  onClearSelection,
  onFitView,
  onCenterSelected,
  onToggleDisabled,
  onAddStickyNote,
  hasSelection,
  canUndo,
  canRedo,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Define available commands
  const commands: CommandAction[] = [
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy className="h-4 w-4" />,
      shortcut: '⌘C',
      disabled: !hasSelection,
      keywords: ['copy', 'clipboard'],
    },
    {
      id: 'paste',
      label: 'Paste',
      icon: <Clipboard className="h-4 w-4" />,
      shortcut: '⌘V',
      keywords: ['paste', 'clipboard'],
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <CopyPlus className="h-4 w-4" />,
      shortcut: '⌘D',
      disabled: !hasSelection,
      keywords: ['duplicate', 'clone', 'copy'],
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      shortcut: '⌫',
      disabled: !hasSelection,
      keywords: ['delete', 'remove', 'trash'],
    },
    {
      id: 'undo',
      label: 'Undo',
      icon: <Undo className="h-4 w-4" />,
      shortcut: '⌘Z',
      disabled: !canUndo,
      keywords: ['undo', 'back', 'revert'],
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: <Redo className="h-4 w-4" />,
      shortcut: '⌘⇧Z',
      disabled: !canRedo,
      keywords: ['redo', 'forward'],
    },
    {
      id: 'selectAll',
      label: 'Select All',
      icon: <SquareDashed className="h-4 w-4" />,
      shortcut: '⌘A',
      keywords: ['select', 'all', 'nodes'],
    },
    {
      id: 'clearSelection',
      label: 'Clear Selection',
      icon: <XCircle className="h-4 w-4" />,
      shortcut: 'Esc',
      disabled: !hasSelection,
      keywords: ['clear', 'deselect', 'selection'],
    },
    {
      id: 'fitView',
      label: 'Fit View',
      icon: <Maximize2 className="h-4 w-4" />,
      shortcut: 'F',
      keywords: ['fit', 'view', 'zoom', 'all'],
    },
    {
      id: 'centerSelected',
      label: 'Center on Selected',
      icon: <Target className="h-4 w-4" />,
      shortcut: 'Space',
      disabled: !hasSelection,
      keywords: ['center', 'focus', 'selected'],
    },
    {
      id: 'toggleDisabled',
      label: 'Toggle Disabled',
      icon: <ToggleLeft className="h-4 w-4" />,
      shortcut: 'D',
      disabled: !hasSelection,
      keywords: ['disable', 'enable', 'toggle', 'skip'],
    },
    {
      id: 'addStickyNote',
      label: 'Add Sticky Note',
      icon: <StickyNote className="h-4 w-4" />,
      shortcut: '⇧S',
      keywords: ['sticky', 'note', 'annotation', 'comment'],
    },
  ];

  // Filter items based on search
  const filteredItems = commands.filter((cmd) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.keywords.some((kw) => kw.includes(searchLower))
    );
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Reset selection when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Execute command
  const executeCommand = useCallback(
    (id: string) => {
      switch (id) {
        case 'copy':
          onCopy();
          break;
        case 'paste':
          onPaste();
          break;
        case 'duplicate':
          onDuplicate();
          break;
        case 'delete':
          onDelete();
          break;
        case 'undo':
          onUndo();
          break;
        case 'redo':
          onRedo();
          break;
        case 'selectAll':
          onSelectAll();
          break;
        case 'clearSelection':
          onClearSelection();
          break;
        case 'fitView':
          onFitView();
          break;
        case 'centerSelected':
          onCenterSelected();
          break;
        case 'toggleDisabled':
          onToggleDisabled();
          break;
        case 'addStickyNote':
          onAddStickyNote();
          break;
      }
      onClose();
    },
    [
      onCopy,
      onPaste,
      onDuplicate,
      onDelete,
      onUndo,
      onRedo,
      onSelectAll,
      onClearSelection,
      onFitView,
      onCenterSelected,
      onToggleDisabled,
      onAddStickyNote,
      onClose,
    ]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          const cmd = filteredItems[selectedIndex];
          if (cmd && !cmd.disabled) {
            executeCommand(cmd.id);
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    },
    [filteredItems, selectedIndex, executeCommand, onClose]
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-72 bg-popover border rounded-lg shadow-xl overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 300),
        top: Math.min(position.y, window.innerHeight - 400),
      }}
    >
      {/* Search Input */}
      <div className="p-2 border-b">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search commands..."
          className="w-full px-2 py-1.5 text-sm bg-transparent border rounded outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Results List */}
      <div className="max-h-72 overflow-y-auto p-1">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No commands found</div>
        ) : (
          filteredItems.map((cmd, index) => (
            <button
              key={cmd.id}
              onClick={() => !cmd.disabled && executeCommand(cmd.id)}
              onMouseEnter={() => setSelectedIndex(index)}
              disabled={cmd.disabled}
              className={cn(
                'flex items-center justify-between w-full p-2 rounded-md text-left',
                'hover:bg-muted transition-colors',
                index === selectedIndex && 'bg-muted',
                cmd.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{cmd.icon}</span>
                <span className="text-sm">{cmd.label}</span>
              </div>
              {cmd.shortcut && (
                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                  {cmd.shortcut}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t bg-muted/50 text-[10px] text-muted-foreground">
        <span className="font-mono">↑↓</span> navigate · <span className="font-mono">↵</span> run · <span className="font-mono">esc</span> close
      </div>
    </div>
  );
}
