'use client';

/**
 * DatabaseNode Component
 *
 * Compact node representing a database.
 * Shows icon, name, and table count badge.
 */

import React, { memo } from 'react';
import { BaseOrgChartNode } from './BaseOrgChartNode';
import type { DatabaseNodeData } from '../types';

interface DatabaseNodeProps {
  data: DatabaseNodeData;
  selected: boolean;
}

export const DatabaseNode = memo(function DatabaseNode({ data, selected }: DatabaseNodeProps) {
  const { name, tableCount, agentId } = data;

  // Format table count for badge
  const badgeText = tableCount !== undefined ? `${tableCount} table${tableCount !== 1 ? 's' : ''}` : undefined;

  return (
    <BaseOrgChartNode
      name={name}
      selected={selected}
      nodeType="database"
      badge={badgeText}
      badgeColor="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      isChild={agentId !== null && agentId !== undefined}
      showHandles={false}
    />
  );
});

export default DatabaseNode;
