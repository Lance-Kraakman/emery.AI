'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WriteNodeData } from '../types';

interface WriteNodeProps {
  data: WriteNodeData;
  selected: boolean;
}

/**
 * WriteNode - Direct database write
 */
export const WriteNode = memo(function WriteNode({
  data,
  selected,
}: WriteNodeProps) {
  const writeConfig = data.writeConfig;
  const rowAction = writeConfig?.rowAction || 'create';
  const mappingsCount = writeConfig?.fieldMappings?.length || 0;

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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-pink-100 dark:bg-pink-900">
            <Database className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
          </div>
          <span className="text-sm font-medium truncate">{data.name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded',
              rowAction === 'create'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
            )}
          >
            {rowAction === 'create' ? 'Create' : 'Update'}
          </span>
          {writeConfig?.targetTableId && (
            <span className="text-xs text-muted-foreground">
              Table #{writeConfig.targetTableId}
            </span>
          )}
        </div>
        {mappingsCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {mappingsCount} field{mappingsCount !== 1 ? 's' : ''} mapped
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
