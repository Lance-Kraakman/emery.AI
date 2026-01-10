'use client';

/**
 * EntityPalette Component
 *
 * Draggable palette for adding new entities to the org chart.
 * Supports creating agents, skills, and databases.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Sparkles, Database, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrgChartNodeType } from '@/components/org-chart/types';

interface PaletteItem {
  type: OrgChartNodeType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const paletteItems: PaletteItem[] = [
  {
    type: 'agent',
    label: 'Agent',
    icon: <Bot className="h-4 w-4" />,
    description: 'Create a new agent',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400',
  },
  {
    type: 'skill',
    label: 'Skill',
    icon: <Sparkles className="h-4 w-4" />,
    description: 'Add a new skill',
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-400',
  },
  {
    type: 'database',
    label: 'Database',
    icon: <Database className="h-4 w-4" />,
    description: 'Create a database',
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
];

interface EntityPaletteProps {
  /** Whether the palette is disabled */
  disabled?: boolean;
  /** Callback when an entity should be created */
  onCreateEntity?: (type: OrgChartNodeType) => void;
}

/**
 * EntityPalette - Drag-and-drop palette for adding entities to org chart
 */
export function EntityPalette({ disabled, onCreateEntity }: EntityPaletteProps) {
  const onDragStart = (event: React.DragEvent, nodeType: OrgChartNodeType) => {
    event.dataTransfer.setData('application/orgchart-entity', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleClick = (type: OrgChartNodeType) => {
    if (!disabled && onCreateEntity) {
      onCreateEntity(type);
    }
  };

  return (
    <Card className="w-48 shadow-lg bg-background">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="h-3 w-3" />
          Add Entity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 space-y-1">
        {paletteItems.map((item) => (
          <div
            key={item.type}
            draggable={!disabled}
            onDragStart={(e) => onDragStart(e, item.type)}
            onClick={() => handleClick(item.type)}
            className={cn(
              'flex items-center gap-2 p-2 rounded-md cursor-grab',
              'hover:bg-muted transition-colors',
              'active:cursor-grabbing',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn('p-1.5 rounded', item.color)}>{item.icon}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default EntityPalette;
