'use client';

import React, { memo } from 'react';
import type { SkillRefNodeData } from '../types';
import { BaseNode } from './BaseNode';

interface SkillRefNodeProps {
  data: SkillRefNodeData;
  selected: boolean;
}

/**
 * SkillRefNode - Reference to another skill
 */
export const SkillRefNode = memo(function SkillRefNode({
  data,
  selected,
}: SkillRefNodeProps) {
  return (
    <BaseNode name={data.name} selected={selected} theme="skill_ref">
      <p className="text-xs text-muted-foreground">
        {data.skillName || `Skill ID: ${data.skillId || 'Not set'}`}
      </p>
      {data.skillType && (
        <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted">
          {data.skillType}
        </span>
      )}
    </BaseNode>
  );
});
