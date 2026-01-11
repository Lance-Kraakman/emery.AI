'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link2, GitBranch, Repeat, Brain, Zap, Wrench, Database, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowNodeType } from './types';

interface PaletteItem {
  type: WorkflowNodeType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  keywords: string[];
}

const paletteItems: PaletteItem[] = [
  {
    type: 'agentic',
    label: 'Agentic',
    icon: <Brain className="h-4 w-4" />,
    description: 'LLM with tools',
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-400',
    keywords: ['llm', 'ai', 'agent', 'claude', 'gpt', 'chat'],
  },
  {
    type: 'operation',
    label: 'Operation',
    icon: <Zap className="h-4 w-4" />,
    description: 'Direct model call',
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
    keywords: ['model', 'direct', 'call', 'invoke'],
  },
  {
    type: 'tool',
    label: 'Tool',
    icon: <Wrench className="h-4 w-4" />,
    description: 'Pipedream action',
    color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    keywords: ['pipedream', 'action', 'api', 'integration'],
  },
  {
    type: 'write',
    label: 'Write',
    icon: <Database className="h-4 w-4" />,
    description: 'Database write',
    color: 'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-400',
    keywords: ['database', 'save', 'insert', 'update', 'create', 'baserow'],
  },
  {
    type: 'read',
    label: 'Read',
    icon: <Search className="h-4 w-4" />,
    description: 'Database read',
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400',
    keywords: ['database', 'query', 'fetch', 'get', 'search', 'baserow'],
  },
  {
    type: 'skillRef',
    label: 'Skill Ref',
    icon: <Link2 className="h-4 w-4" />,
    description: 'Reference another skill',
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    keywords: ['skill', 'reference', 'call', 'sub', 'workflow'],
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: <GitBranch className="h-4 w-4" />,
    description: 'Branch based on condition',
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400',
    keywords: ['if', 'else', 'branch', 'switch', 'logic'],
  },
  {
    type: 'loop',
    label: 'Loop',
    icon: <Repeat className="h-4 w-4" />,
    description: 'Iterate over items',
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-400',
    keywords: ['for', 'each', 'iterate', 'repeat', 'while'],
  },
];

interface QuickAddPopoverProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onSelect: (type: WorkflowNodeType) => void;
}

export function QuickAddPopover({
  isOpen,
  position,
  onClose,
  onSelect,
}: QuickAddPopoverProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter items based on search
  const filteredItems = paletteItems.filter((item) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.label.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower) ||
      item.keywords.some((kw) => kw.includes(searchLower))
    );
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Reset selection when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

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
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex].type);
            onClose();
          }
          break;
        case 'Escape':
        case 'Tab':
          event.preventDefault();
          onClose();
          break;
      }
    },
    [filteredItems, selectedIndex, onSelect, onClose]
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
      className="fixed z-50 w-64 bg-popover border rounded-lg shadow-xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
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
          placeholder="Search nodes..."
          className="w-full px-2 py-1.5 text-sm bg-transparent border rounded outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Results List */}
      <div className="max-h-64 overflow-y-auto p-1">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No results found</div>
        ) : (
          filteredItems.map((item, index) => (
            <button
              key={item.type}
              onClick={() => {
                onSelect(item.type);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'flex items-center gap-2 w-full p-2 rounded-md text-left',
                'hover:bg-muted transition-colors',
                index === selectedIndex && 'bg-muted'
              )}
            >
              <div className={cn('p-1.5 rounded', item.color)}>{item.icon}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t bg-muted/50 text-[10px] text-muted-foreground">
        <span className="font-mono">↑↓</span> navigate · <span className="font-mono">↵</span> select · <span className="font-mono">esc</span> close
      </div>
    </div>
  );
}
