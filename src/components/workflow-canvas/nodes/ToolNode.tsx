'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolNodeData } from '../types';

interface ToolNodeProps {
  data: ToolNodeData;
  selected: boolean;
}

/**
 * ToolNode - Direct Pipedream tool execution
 */
export const ToolNode = memo(function ToolNode({
  data,
  selected,
}: ToolNodeProps) {
  const toolId = data.toolExecutionConfig?.toolId;
  const mappingsCount = data.toolExecutionConfig?.inputMappings?.length || 0;

  // Format tool name for display (e.g., "gmail-send-email" -> "Gmail Send Email")
  const toolName = toolId
    ? toolId
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'No tool selected';

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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-green-100 dark:bg-green-900">
            <Wrench className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          </div>
          <span className="text-sm font-medium truncate">{data.name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        <p className="text-xs text-muted-foreground truncate">{toolName}</p>
        {mappingsCount > 0 && (
          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted">
            {mappingsCount} input{mappingsCount !== 1 ? 's' : ''} mapped
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
