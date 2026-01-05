'use client';

import React, { memo } from 'react';
import type { AgenticNodeData } from '../types';
import { BaseNode } from './BaseNode';

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
    <BaseNode name={data.name} selected={selected} theme="agentic">
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
    </BaseNode>
  );
});
