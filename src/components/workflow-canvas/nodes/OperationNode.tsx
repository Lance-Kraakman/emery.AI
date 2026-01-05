'use client';

import React, { memo } from 'react';
import type { OperationNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface OperationNodeProps {
  data: OperationNodeData;
  selected: boolean;
}

/**
 * OperationNode - Direct model invocation (compact view)
 */
export const OperationNode = memo(function OperationNode({
  data,
  selected,
}: OperationNodeProps) {
  return <BaseNode name={data.name} selected={selected} theme="operation" />;
});
