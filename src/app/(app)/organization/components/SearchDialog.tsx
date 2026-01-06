'use client';

/**
 * SearchDialog Component
 *
 * Cmd+K search dialog for finding entities in the org chart.
 * Filters agents, skills, and databases and allows quick navigation.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, Bot, Sparkles, Database, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { OrgChartNodeType } from '@/components/org-chart/types';

interface SearchResult {
  id: string;
  type: OrgChartNodeType;
  name: string;
  subtitle?: string;
  entityId: number;
}

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Array<{ id: number; name: string; role?: string }>;
  skills: Array<{ id: number; name: string; executionType?: string; agentId?: number | null }>;
  databases: Array<{ id: number; name: string; slug: string; agentId?: number | null }>;
  onSelectEntity: (nodeId: string, type: OrgChartNodeType, entityId: number) => void;
}

/**
 * Get icon for entity type
 */
function getEntityIcon(type: OrgChartNodeType) {
  switch (type) {
    case 'agent':
      return <Bot className="h-4 w-4 text-emerald-500" />;
    case 'skill':
      return <Sparkles className="h-4 w-4 text-violet-500" />;
    case 'database':
      return <Database className="h-4 w-4 text-slate-500" />;
    default:
      return null;
  }
}

export function SearchDialog({
  isOpen,
  onClose,
  agents,
  skills,
  databases,
  onSelectEntity,
}: SearchDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build search results
  const results = useMemo(() => {
    const items: SearchResult[] = [];

    // Add agents
    agents.forEach((agent) => {
      items.push({
        id: `agent-${agent.id}`,
        type: 'agent',
        name: agent.name,
        subtitle: agent.role,
        entityId: agent.id,
      });
    });

    // Add skills
    skills.forEach((skill) => {
      const agent = agents.find((a) => a.id === skill.agentId);
      items.push({
        id: `skill-${skill.id}`,
        type: 'skill',
        name: skill.name,
        subtitle: agent ? `${agent.name}` : 'Organization',
        entityId: skill.id,
      });
    });

    // Add databases
    databases.forEach((db) => {
      const agent = agents.find((a) => a.id === db.agentId);
      items.push({
        id: `database-${db.id}`,
        type: 'database',
        name: db.name,
        subtitle: agent ? `${agent.name}` : 'Organization',
        entityId: db.id,
      });
    });

    // Filter by search term
    if (!search.trim()) {
      return items;
    }

    const searchLower = search.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        item.subtitle?.toLowerCase().includes(searchLower)
    );
  }, [agents, skills, databases, search]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            const item = results[selectedIndex];
            onSelectEntity(item.id, item.type, item.entityId);
            onClose();
            setSearch('');
          }
          break;
        case 'Escape':
          onClose();
          setSearch('');
          break;
      }
    },
    [results, selectedIndex, onSelectEntity, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results.length]);

  const handleSelect = (item: SearchResult) => {
    onSelectEntity(item.id, item.type, item.entityId);
    onClose();
    setSearch('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search Entities
          </DialogTitle>
        </DialogHeader>

        <div className="p-2">
          <Input
            ref={inputRef}
            placeholder="Search agents, skills, databases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9"
          />
        </div>

        <div
          ref={listRef}
          className="max-h-[300px] overflow-y-auto border-t"
        >
          {results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 text-left',
                  'hover:bg-muted transition-colors',
                  index === selectedIndex && 'bg-muted'
                )}
              >
                {getEntityIcon(item.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  {item.subtitle && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {item.type}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center gap-4">
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> Select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SearchDialog;
