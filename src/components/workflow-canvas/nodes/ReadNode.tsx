'use client';

import React, { memo } from 'react';
import type { ReadNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface ReadNodeProps {
  data: ReadNodeData;
  selected: boolean;
}

/**
 * ReadNode - Database read (compact view)
 */
export const ReadNode = memo(function ReadNode({
  data,
  selected,
}: ReadNodeProps) {
  return <BaseNode name={data.name} selected={selected} theme="read" isDisabled={data.isDisabled} />;
});
