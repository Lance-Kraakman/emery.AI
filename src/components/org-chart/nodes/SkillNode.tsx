'use client';

/**
 * SkillNode Component
 *
 * Compact node representing a skill.
 * Shows icon, name, and execution type badge.
 * Org-level skills (agentId === null) can be dragged onto agent panels
 * using React Flow's native drag - handled by onNodeDragStop in OrgChartCanvas.
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
  const { name, executionType } = data;
  const badgeText = executionType || 'agentic';
  const badgeColor = getSkillTypeBadgeColor(executionType);

  return (
    <BaseOrgChartNode
      name={name}
      selected={selected}
      nodeType="skill"
      badge={badgeText}
      badgeColor={badgeColor}
      showHandles
    />
  );
});

export default SkillNode;
