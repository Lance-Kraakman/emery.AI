'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConditionNodeData } from '../types';

interface ConditionNodeProps {
  data: ConditionNodeData;
  selected: boolean;
}

/**
 * ConditionNode - Branching based on conditions
 */
export const ConditionNode = memo(function ConditionNode({
  data,
  selected,
}: ConditionNodeProps) {
  const conditions = data.conditions || [];

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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 dark:bg-amber-900">
            <GitBranch className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-sm font-medium truncate">{data.name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        {conditions.length > 0 ? (
          <div className="space-y-1">
            {conditions.map((cond, i) => (
              <p key={i} className="text-xs text-muted-foreground truncate">
                {cond.label || cond.expression || `Condition ${i + 1}`}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No conditions set</p>
        )}
      </CardContent>

      {/* Dynamic output handles for each condition */}
      {conditions.map((_, i) => (
        <Handle
          key={`cond_${i}`}
          type="source"
          position={Position.Bottom}
          id={`cond_${i}`}
          className="!bg-blue-500 !w-3 !h-3"
          style={{
            left: `${((i + 1) / (conditions.length + 2)) * 100}%`,
          }}
        />
      ))}

      {/* Default output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!bg-gray-500 !w-3 !h-3"
        style={{
          left: `${((conditions.length + 1) / (conditions.length + 2)) * 100}%`,
        }}
      />
    </Card>
  );
});
