'use client';

import React, { memo } from 'react';
import type { SkillRefNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface SkillRefNodeProps {
  data: SkillRefNodeData;
  selected: boolean;
}

/**
 * SkillRefNode - Reference to another skill (compact view)
 */
export const SkillRefNode = memo(function SkillRefNode({
  data,
  selected,
}: SkillRefNodeProps) {
  return <BaseNode name={data.name} selected={selected} theme="skill_ref" isDisabled={data.isDisabled} />;
});
