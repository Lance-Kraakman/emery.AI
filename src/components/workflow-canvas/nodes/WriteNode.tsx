'use client';

import React, { memo } from 'react';
import type { WriteNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface WriteNodeProps {
  data: WriteNodeData;
  selected: boolean;
}

/**
 * WriteNode - Database write (compact view)
 */
export const WriteNode = memo(function WriteNode({
  data,
  selected,
}: WriteNodeProps) {
  return <BaseNode name={data.name} selected={selected} theme="write" isDisabled={data.isDisabled} />;
});
