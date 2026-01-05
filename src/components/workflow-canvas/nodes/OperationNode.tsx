'use client';

import React, { memo } from 'react';
import type { OperationNodeData } from '../types';
import { BaseNode } from './BaseNode';

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
    <BaseNode name={data.name} selected={selected} theme="operation">
      <p className="text-xs text-muted-foreground truncate">{modelName}</p>
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
    </BaseNode>
  );
});
