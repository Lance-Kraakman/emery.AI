'use client';

/**
 * EntityPalette Component
 *
 * Icon-only vertical toolbar for adding new entities to the org chart.
 * Supports creating agents, skills, and databases via drag or click.
 */

import React from 'react';
import { Bot, Sparkles, Database, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrgChartDragSafe } from '@/components/org-chart/context';
import type { OrgChartNodeType } from '@/components/org-chart/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

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
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-1 bg-background/50 backdrop-blur-sm border rounded-lg shadow-sm p-1">
        <div className="flex items-center justify-center h-8 w-8">
          <Plus className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="h-px bg-border mx-1" />
        {paletteItems.map((item) => (
          <Tooltip key={item.type}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', disabled && 'opacity-50')}
                draggable={!disabled}
                onDragStart={(e) => onDragStart(e, item.type)}
                onDragEnd={onDragEnd}
                onClick={() => handleClick(item.type)}
                disabled={disabled}
              >
                {item.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

export default EntityPalette;
