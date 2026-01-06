'use client';

/**
 * SkillNode Component
 *
 * Compact node representing a skill.
 * Shows icon, name, and execution type badge.
 */

import React, { memo } from 'react';
import { BaseOrgChartNode } from './BaseOrgChartNode';
import { getSkillTypeBadgeColor } from '../theme';
import type { SkillNodeData } from '../types';

interface SkillNodeProps {
  data: SkillNodeData;
  selected: boolean;
}

export const SkillNode = memo(function SkillNode({ data, selected }: SkillNodeProps) {
  const { name, executionType, agentId } = data;

  // Format execution type for display
  const badgeText = executionType || 'agentic';
  const badgeColor = getSkillTypeBadgeColor(executionType);

  return (
    <BaseOrgChartNode
      name={name}
      selected={selected}
      nodeType="skill"
      badge={badgeText}
      badgeColor={badgeColor}
      isChild={agentId !== null && agentId !== undefined}
      showHandles={false}
    />
  );
});

export default SkillNode;
