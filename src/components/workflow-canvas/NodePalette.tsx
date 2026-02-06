'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link2, GitBranch, Repeat, Brain, Zap, Wrench, Database, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodePaletteProps, WorkflowNodeType } from './types';

interface PaletteItem {
  type: WorkflowNodeType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const paletteItems: PaletteItem[] = [
  // Execution nodes
  {
    type: 'agentic',
    label: 'Agentic',
    icon: <Brain className="h-4 w-4" />,
    description: 'LLM with tools',
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-400',
  },
  {
    type: 'operation',
    label: 'Operation',
    icon: <Zap className="h-4 w-4" />,
    description: 'Direct model call',
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
  },
  {
    type: 'tool',
    label: 'Tool',
    icon: <Wrench className="h-4 w-4" />,
    description: 'Pipedream action',
    color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
  },
  {
    type: 'write',
    label: 'Write',
    icon: <Database className="h-4 w-4" />,
    description: 'Database write',
    color: 'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-400',
  },
  {
    type: 'read',
    label: 'Read',
    icon: <Search className="h-4 w-4" />,
    description: 'Database read',
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400',
  },
  // Flow control nodes
  {
    type: 'skillRef',
    label: 'Skill Ref',
    icon: <Link2 className="h-4 w-4" />,
    description: 'Reference another skill',
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: <GitBranch className="h-4 w-4" />,
    description: 'Branch based on condition',
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400',
  },
  {
    type: 'loop',
    label: 'Loop',
    icon: <Repeat className="h-4 w-4" />,
    description: 'Iterate over items',
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-400',
  },
];

/**
 * NodePalette - Drag-and-drop palette for adding nodes
 */
export function NodePalette({ disabled }: NodePaletteProps) {
  const onDragStart = (
    event: React.DragEvent,
    nodeType: WorkflowNodeType
  ) => {
    event.stopPropagation();
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card className="w-48 shadow-lg nopan nodrag">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Add Node
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 space-y-1">
        {paletteItems.map((item) => (
          <div
            key={item.type}
            draggable={!disabled}
            onDragStart={(e) => onDragStart(e, item.type)}
            className={cn(
              'flex items-center gap-2 p-2 rounded-md cursor-grab nopan nodrag',
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
