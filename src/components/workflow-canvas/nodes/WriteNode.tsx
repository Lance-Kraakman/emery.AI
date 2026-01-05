'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import type { WriteNodeData } from '../types';
import { BaseNode } from './BaseNode';

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
    <BaseNode name={data.name} selected={selected} theme="write">
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
    </BaseNode>
  );
});
