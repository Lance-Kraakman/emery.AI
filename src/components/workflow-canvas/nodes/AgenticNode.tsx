'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgenticNodeData } from '../types';

interface AgenticNodeProps {
  data: AgenticNodeData;
  selected: boolean;
}

/**
 * AgenticNode - LLM with instructions and tool access
 */
export const AgenticNode = memo(function AgenticNode({
  data,
  selected,
}: AgenticNodeProps) {
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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-100 dark:bg-violet-900">
            <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="text-sm font-medium truncate">{data.name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {data.instructions || 'No instructions set'}
        </p>
        {data.tools && data.tools.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.tools.slice(0, 2).map((tool, idx) => (
              <span
                key={idx}
                className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300"
              >
                {tool.name}
              </span>
            ))}
            {data.tools.length > 2 && (
              <span className="text-[10px] text-muted-foreground">
                +{data.tools.length - 2}
              </span>
            )}
          </div>
        )}
        {data.agentType && (
          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted">
            {data.agentType === 'code_agent' ? 'Code Agent' : 'Tool Calling'}
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
