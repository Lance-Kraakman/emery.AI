'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperationNodeData } from '../types';

interface OperationNodeProps {
  data: OperationNodeData;
  selected: boolean;
}

/**
 * OperationNode - Direct model invocation (HuggingFace)
 */
export const OperationNode = memo(function OperationNode({
  data,
  selected,
}: OperationNodeProps) {
  const taskType = data.taskModelConfig?.taskType;
  const modelId = data.taskModelConfig?.modelId;

  // Format model name for display
  const modelName = modelId?.split('/').pop() || 'No model';

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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-orange-100 dark:bg-orange-900">
            <Zap className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
          </div>
          <span className="text-sm font-medium truncate">{data.name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        <p className="text-xs text-muted-foreground truncate">
          {modelName}
        </p>
        {taskType && (
          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
            {taskType.replace(/-/g, ' ')}
          </span>
        )}
        {data.promptTemplate && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
            {data.promptTemplate}
          </p>
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
