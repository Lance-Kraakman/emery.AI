'use client';

import React, { memo, useState, useCallback } from 'react';
import { NodeResizer } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { StickyNodeData } from '../types';

interface StickyNodeProps {
  data: StickyNodeData;
  selected: boolean;
}

const colorClasses = {
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
  blue: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
  green: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
  pink: 'bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700',
  purple: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700',
};

/**
 * StickyNode - Canvas annotation note
 * Purely for documentation, does not participate in workflow execution
 */
export const StickyNode = memo(function StickyNode({
  data,
  selected,
}: StickyNodeProps) {
  const color = data.color || 'yellow';

  return (
    <>
      <NodeResizer
        minWidth={120}
        minHeight={80}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!w-2 !h-2 !bg-primary !border-primary"
      />
      <div
        className={cn(
          'min-w-[120px] min-h-[80px] w-full h-full rounded-lg border-2 p-3 shadow-md',
          colorClasses[color],
          selected && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        {data.name && (
          <div className="font-semibold text-sm mb-1 text-foreground/80">
            {data.name}
          </div>
        )}
        <div className="text-xs text-foreground/70 whitespace-pre-wrap">
          {data.content || 'Double-click to edit...'}
        </div>
      </div>
    </>
  );
});
