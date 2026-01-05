'use client';

import React, { memo } from 'react';
import type { LoopNodeData } from '../types';
import { BaseNode } from './BaseNode';

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
    <BaseNode name={data.name} selected={selected} theme="loop">
      <p className="text-xs text-muted-foreground">{getLoopDescription()}</p>
      {loopConfig?.maxIterations && (
        <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted">
          Max: {loopConfig.maxIterations}
        </span>
      )}
    </BaseNode>
  );
});
