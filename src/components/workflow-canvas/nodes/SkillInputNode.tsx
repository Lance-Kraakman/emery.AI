'use client';

/**
 * SkillInputNode Component
 *
 * Virtual node showing skill inputs at the TOP of the canvas.
 * Horizontal layout with handles on the bottom edge.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { nodeTheme } from '../theme';
import type { SkillInputNodeData } from '../types';
import { Table2 } from 'lucide-react';

interface SkillInputNodeProps {
  data: SkillInputNodeData;
  selected: boolean;
}

/**
 * SkillInputNode - Shows skill inputs horizontally with handles on bottom
 */
export const SkillInputNode = memo(function SkillInputNode({
  data,
  selected,
}: SkillInputNodeProps) {
  const theme = nodeTheme.skillInput;
  const Icon = theme.icon;
  const inputs = data.inputs || [];

  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm transition-all',
        selected && 'ring-2 ring-primary shadow-md',
        !selected && 'hover:shadow-md'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-center gap-2 px-3 py-1.5 border-b', theme.bg)}>
        <div className="flex h-4 w-4 items-center justify-center rounded bg-white/50 dark:bg-black/20">
          <Icon className={cn('h-2.5 w-2.5', theme.text)} />
        </div>
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', theme.text)}>
          Inputs
        </span>
      </div>

      {/* Horizontal input list */}
      <div className="relative flex items-stretch px-2 py-2 gap-3 min-h-[40px]">
        {inputs.length === 0 ? (
          <div className="text-[10px] text-muted-foreground italic px-2">
            No inputs
          </div>
        ) : (
          inputs.map((input, index) => {
            const hasTableMapping = input.inputMapping?.source?.type === 'table_field';
            // Calculate handle position as percentage
            const handleLeft = `${((index + 0.5) / inputs.length) * 100}%`;

            return (
              <div
                key={input.name}
                className="flex flex-col items-center gap-0.5 min-w-[60px]"
              >
                <div className="flex items-center gap-1">
                  {hasTableMapping && (
                    <Table2 className="h-2.5 w-2.5 text-muted-foreground" />
                  )}
                  <span className="text-[10px] font-medium truncate max-w-[80px]">
                    {input.name}
                  </span>
                  {input.required && (
                    <span className="text-red-500 text-[10px]">*</span>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {input.type || 'any'}
                </span>

                {/* Source handle on bottom edge */}
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={`input_${input.name}`}
                  className="!bg-blue-500 !w-2.5 !h-2.5"
                  style={{
                    left: handleLeft,
                    bottom: 0,
                    transform: 'translateX(-50%) translateY(50%)',
                  }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
