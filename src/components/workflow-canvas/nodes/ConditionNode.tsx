'use client';

import React, { memo, useMemo } from 'react';
import type { ConditionNodeData } from '../types';
import type { CustomHandleConfig } from '../theme';
import { BaseNode } from './BaseNode';

interface ConditionNodeProps {
  data: ConditionNodeData;
  selected: boolean;
}

/**
 * ConditionNode - Branching based on conditions
 * Uses custom output handles for each condition + default
 */
export const ConditionNode = memo(function ConditionNode({
  data,
  selected,
}: ConditionNodeProps) {
  const conditions = data.conditions || [];

  // Build dynamic handle configuration for conditions
  const outputHandles = useMemo((): CustomHandleConfig[] => {
    const totalHandles = conditions.length + 1; // +1 for default
    const conditionHandles: CustomHandleConfig[] = conditions.map((_, i) => ({
      id: `cond_${i}`,
      label: conditions[i].label || `Condition ${i + 1}`,
      color: '!bg-blue-500',
      offset: `${((i + 1) / (totalHandles + 1)) * 100}%`,
    }));

    // Add default handle at the end
    conditionHandles.push({
      id: 'default',
      label: 'Default',
      color: '!bg-gray-500',
      offset: `${((conditions.length + 1) / (totalHandles + 1)) * 100}%`,
    });

    return conditionHandles;
  }, [conditions]);

  return (
    <BaseNode
      name={data.name}
      selected={selected}
      theme="condition"
      outputHandles={outputHandles}
    >
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
    </BaseNode>
  );
});
