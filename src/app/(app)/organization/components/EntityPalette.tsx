'use client';

/**
 * EntityPalette Component
 *
 * Icon-only vertical toolbar for adding new entities to the org chart.
 * Supports creating agents, skills, and databases via drag or click.
 */

import React from 'react';
import { Bot, Sparkles, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrgChartDragSafe } from '@/components/org-chart/context';
import type { OrgChartNodeType } from '@/components/org-chart/types';

interface PaletteItem {
  type: OrgChartNodeType;
  label: string;
  icon: React.ReactNode;
}

const paletteItems: PaletteItem[] = [
  {
    type: 'agent',
    label: 'Agent',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    type: 'skill',
    label: 'Skill',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    type: 'database',
    label: 'Database',
    icon: <Database className="h-4 w-4" />,
  },
];

interface EntityPaletteProps {
  disabled?: boolean;
  onCreateEntity?: (type: OrgChartNodeType) => void;
}

export function EntityPalette({ disabled, onCreateEntity }: EntityPaletteProps) {
  const { setDragType } = useOrgChartDragSafe();

  const onDragStart = (event: React.DragEvent, nodeType: OrgChartNodeType) => {
    event.dataTransfer.setData('application/orgchart-entity', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    setDragType(nodeType);
  };

  const onDragEnd = () => {
    setDragType(null);
  };

  const handleClick = (type: OrgChartNodeType) => {
    if (!disabled && onCreateEntity) {
      onCreateEntity(type);
    }
  };

  return (
    <div className="flex flex-col gap-1 bg-background/50 backdrop-blur-sm border rounded-lg shadow-sm p-1">
      {paletteItems.map((item) => (
        <div
          key={item.type}
          role="button"
          title={item.label}
          className={cn(
            'h-8 w-8 flex items-center justify-center rounded-md',
            'hover:bg-accent hover:text-accent-foreground',
            'cursor-grab active:cursor-grabbing transition-colors',
            disabled && 'opacity-50 pointer-events-none'
          )}
          draggable={!disabled}
          onDragStart={(e) => onDragStart(e, item.type)}
          onDragEnd={onDragEnd}
          onClick={() => handleClick(item.type)}
        >
          {item.icon}
        </div>
      ))}
    </div>
  );
}

export default EntityPalette;
