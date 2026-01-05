'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ReadNodeData } from '../types';
import { BaseNode } from './BaseNode';

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
    <BaseNode name={data.name} selected={selected} theme="read">
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
    </BaseNode>
  );
});
