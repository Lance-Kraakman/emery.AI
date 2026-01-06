'use client';

import React, { memo } from 'react';
import type { AgenticNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface AgenticNodeProps {
  data: AgenticNodeData;
  selected: boolean;
}

/**
 * AgenticNode - LLM with instructions and tool access (compact view)
 */
export const AgenticNode = memo(function AgenticNode({
  data,
  selected,
}: AgenticNodeProps) {
  return <BaseNode name={data.name} selected={selected} theme="agentic" isDisabled={data.isDisabled} />;
});
