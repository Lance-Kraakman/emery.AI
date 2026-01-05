'use client';

import React, { memo } from 'react';
import type { ToolNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface ToolNodeProps {
  data: ToolNodeData;
  selected: boolean;
}

/**
 * ToolNode - Direct Pipedream tool execution
 */
export const ToolNode = memo(function ToolNode({
  data,
  selected,
}: ToolNodeProps) {
  const toolId = data.toolExecutionConfig?.toolId;
  const mappingsCount = data.toolExecutionConfig?.inputMappings?.length || 0;

  // Format tool name for display (e.g., "gmail-send-email" -> "Gmail Send Email")
  const toolName = toolId
    ? toolId
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'No tool selected';

  return (
    <BaseNode name={data.name} selected={selected} theme="tool">
      <p className="text-xs text-muted-foreground truncate">{toolName}</p>
      {mappingsCount > 0 && (
        <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted">
          {mappingsCount} input{mappingsCount !== 1 ? 's' : ''} mapped
        </span>
      )}
    </BaseNode>
  );
});
