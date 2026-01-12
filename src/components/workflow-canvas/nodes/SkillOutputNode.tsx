'use client';

/**
 * SkillOutputNode Component
 *
 * Virtual node showing skill outputs at the BOTTOM of the canvas.
 * Horizontal layout with handles on the top edge.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { nodeTheme } from '../theme';
import type { SkillOutputNodeData } from '../types';
import { Table2 } from 'lucide-react';

interface SkillOutputNodeProps {
  data: SkillOutputNodeData;
  selected: boolean;
}

/**
 * SkillOutputNode - Shows skill outputs horizontally with handles on top
 */
export const SkillOutputNode = memo(function SkillOutputNode({
  data,
  selected,
}: SkillOutputNodeProps) {
  const theme = nodeTheme.skillOutput;
  const Icon = theme.icon;
  const outputs = data.outputs || [];

  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm transition-all',
        selected && 'ring-2 ring-primary shadow-md',
        !selected && 'hover:shadow-md'
      )}
    >
      {/* Horizontal output list */}
      <div className="relative flex items-stretch px-2 py-2 gap-3 min-h-[40px]">
        {outputs.length === 0 ? (
          <div className="text-[10px] text-muted-foreground italic px-2">
            No outputs
          </div>
        ) : (
          outputs.map((output, index) => {
            const hasTableMapping = Boolean(output.outputMapping);
            const hasSource = Boolean(output.source);
            // Calculate handle position as percentage
            const handleLeft = `${((index + 0.5) / outputs.length) * 100}%`;

            return (
              <div
                key={output.name}
                className="flex flex-col items-center gap-0.5 min-w-[60px]"
              >
                {/* Target handle on top edge */}
                <Handle
                  type="target"
                  position={Position.Top}
                  id={`output_${output.name}`}
                  className="!bg-emerald-500 !w-2.5 !h-2.5"
                  style={{
                    left: handleLeft,
                    top: 0,
                    transform: 'translateX(-50%) translateY(-50%)',
                  }}
                />

                {/* Source indicator */}
                {hasSource && output.source && (
                  <span className="text-[8px] text-blue-500 truncate max-w-[70px]" title={`← ${output.source.nodeId}.${output.source.outputName}`}>
                    ← {output.source.outputName}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium truncate max-w-[80px]">
                    {output.name}
                  </span>
                  {hasTableMapping && (
                    <Table2 className="h-2.5 w-2.5 text-muted-foreground" />
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {output.type || 'any'}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className={cn('flex items-center justify-center gap-2 px-3 py-1.5 border-t', theme.bg)}>
        <div className="flex h-4 w-4 items-center justify-center rounded bg-white/50 dark:bg-black/20">
          <Icon className={cn('h-2.5 w-2.5', theme.text)} />
        </div>
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', theme.text)}>
          Outputs
        </span>
      </div>
    </div>
  );
});
