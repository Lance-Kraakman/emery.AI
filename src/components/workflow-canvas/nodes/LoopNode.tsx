'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoopNodeData } from '../types';

interface LoopNodeProps {
  data: LoopNodeData;
  selected: boolean;
}

/**
 * LoopNode - Iteration support (for_each, while, until)
 */
export const LoopNode = memo(function LoopNode({
  data,
  selected,
}: LoopNodeProps) {
  const loopConfig = data.loopConfig;
  const loopType = loopConfig?.type || 'for_each';

  const getLoopDescription = () => {
    if (!loopConfig) return 'No loop configured';

    switch (loopType) {
      case 'for_each':
        return `For each item in {{${loopConfig.itemsVar || '?'}}}`;
      case 'while':
        return `While: ${loopConfig.condition || 'condition'}`;
      case 'until':
        return `Until: ${loopConfig.condition || 'condition'}`;
      default:
        return 'Loop';
    }
  };

  return (
    <Card
      className={cn(
        'min-w-[200px] max-w-[280px] shadow-md transition-shadow',
        selected && 'ring-2 ring-primary shadow-lg'
      )}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !w-3 !h-3"
      />

      <CardHeader className="p-3 pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-teal-100 dark:bg-teal-900">
            <Repeat className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          </div>
          <span className="text-sm font-medium truncate">{data.name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        <p className="text-xs text-muted-foreground">{getLoopDescription()}</p>
        {loopConfig?.maxIterations && (
          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted">
            Max: {loopConfig.maxIterations}
          </span>
        )}
      </CardContent>

      {/* Output handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        className="!bg-green-500 !w-3 !h-3"
        style={{ left: '35%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="error"
        className="!bg-red-500 !w-3 !h-3"
        style={{ left: '65%' }}
      />
    </Card>
  );
});
