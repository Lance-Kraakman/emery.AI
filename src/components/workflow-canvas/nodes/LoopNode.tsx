'use client';

import React, { memo } from 'react';
import type { LoopNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface LoopNodeProps {
  data: LoopNodeData;
  selected: boolean;
}

/**
 * LoopNode - Iteration support (compact view)
 */
export const LoopNode = memo(function LoopNode({
  data,
  selected,
}: LoopNodeProps) {
  return <BaseNode name={data.name} selected={selected} theme="loop" />;
});
