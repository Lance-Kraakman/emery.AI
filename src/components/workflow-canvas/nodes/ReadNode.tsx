'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReadNodeData } from '../types';

interface ReadNodeProps {
  data: ReadNodeData;
  selected: boolean;
}

/**
 * ReadNode - Database read (single-row or query)
 */
export const ReadNode = memo(function ReadNode({
  data,
  selected,
}: ReadNodeProps) {
  const readConfig = data.readConfig;
  const mode = readConfig?.mode || 'single_row';
  const mappingsCount = readConfig?.fieldMappings?.length || 0;
  const filtersCount = readConfig?.queryFilters?.length || 0;

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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-100 dark:bg-cyan-900">
            <Search className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <span className="text-sm font-medium truncate">{data.name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded',
              mode === 'single_row'
                ? 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300'
                : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
            )}
          >
            {mode === 'single_row' ? 'Single Row' : 'Query'}
          </span>
          {readConfig?.sourceTableId && (
            <span className="text-xs text-muted-foreground">
              Table #{readConfig.sourceTableId}
            </span>
          )}
        </div>
        <div className="mt-1 space-y-0.5">
          {mappingsCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {mappingsCount} field{mappingsCount !== 1 ? 's' : ''} → outputs
            </p>
          )}
          {mode === 'query' && filtersCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {filtersCount} filter{filtersCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
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
