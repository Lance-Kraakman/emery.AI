'use client';

/**
 * SkillNode Component
 *
 * Compact node representing a skill.
 * Shows icon, name, and execution type badge.
 * Org-level skills (agentId === null) can be dragged onto agent panels.
 */

import React, { memo, useCallback } from 'react';
import { BaseOrgChartNode } from './BaseOrgChartNode';
import { getSkillTypeBadgeColor } from '../theme';
import type { SkillNodeData } from '../types';

interface SkillNodeProps {
  data: SkillNodeData;
  selected: boolean;
}

export const SkillNode = memo(function SkillNode({ data, selected }: SkillNodeProps) {
  const { name, executionType, skillId, agentId } = data;
  const badgeText = executionType || 'agentic';
  const badgeColor = getSkillTypeBadgeColor(executionType);

  // Org-level skills can be dragged onto agent panels
  const isOrgLevel = agentId === null || agentId === undefined;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!isOrgLevel) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData(
        'application/existing-entity',
        JSON.stringify({
          type: 'skill',
          id: skillId,
          name: name,
          agentId: agentId,
        })
      );
      e.dataTransfer.effectAllowed = 'move';
    },
    [isOrgLevel, skillId, name, agentId]
  );

  return (
    <div
      draggable={isOrgLevel}
      onDragStart={handleDragStart}
      className={isOrgLevel ? 'cursor-grab active:cursor-grabbing' : ''}
    >
      <BaseOrgChartNode
        name={name}
        selected={selected}
        nodeType="skill"
        badge={badgeText}
        badgeColor={badgeColor}
        showHandles
      />
    </div>
  );
});

export default SkillNode;
