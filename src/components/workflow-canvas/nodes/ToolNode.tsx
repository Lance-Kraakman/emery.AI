'use client';

import React, { memo } from 'react';
import type { ToolNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface ToolNodeProps {
  data: ToolNodeData;
  selected: boolean;
}

/**
 * ToolNode - Direct Pipedream tool execution (compact view)
 */
export const ToolNode = memo(function ToolNode({
  data,
  selected,
}: ToolNodeProps) {
  return <BaseNode name={data.name} selected={selected} theme="tool" />;
});
