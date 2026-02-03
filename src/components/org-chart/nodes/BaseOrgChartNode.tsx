'use client';

/**
 * BaseOrgChartNode Component
 *
 * Compact node for org chart entities - icon + name + optional badge.
 * Used for skills, databases, tables, automations, apps.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { orgChartNodeTheme, orgChartHandles } from '../theme';
import type { OrgChartNodeType } from '../types';

/**
 * IconBadge - Colored icon badge for node headers
 */
interface IconBadgeProps {
  nodeType: OrgChartNodeType;
}

export function IconBadge({ nodeType }: IconBadgeProps) {
  const config = orgChartNodeTheme[nodeType];
  const Icon = config.icon;

  return (
    <div className={cn('flex h-6 w-6 items-center justify-center rounded', config.bg, config.border, 'border')}>
      <Icon className={cn('h-3.5 w-3.5', config.text)} />
    </div>
  );
}

/**
 * NodeHandles - Bidirectional connection handles for org chart nodes
 *
 * Renders 4 handles (2 per side) so users can connect from either side.
 */
export function NodeHandles() {
  return (
    <>
      {/* Left side */}
      <Handle id="left-target" type="target" position={Position.Left} className={orgChartHandles.referenceTarget.className} />
      <Handle id="left-source" type="source" position={Position.Left} className={orgChartHandles.referenceSource.className} />
      {/* Right side */}
      <Handle id="right-target" type="target" position={Position.Right} className={orgChartHandles.referenceTarget.className} />
      <Handle id="right-source" type="source" position={Position.Right} className={orgChartHandles.referenceSource.className} />
    </>
  );
}

/**
 * BaseOrgChartNode props
 */
interface BaseOrgChartNodeProps {
  /** Node display name */
  name: string;
  /** Whether this node is selected */
  selected: boolean;
  /** Node type for styling */
  nodeType: OrgChartNodeType;
  /** Optional badge text (e.g., "agentic", "3 tables") */
  badge?: string;
  /** Badge color class */
  badgeColor?: string;
  /** Whether to show handles for connections */
  showHandles?: boolean;
  /** Optional additional content below the header */
  children?: React.ReactNode;
}

/**
 * BaseOrgChartNode - Compact node for org chart
 */
export const BaseOrgChartNode = memo(function BaseOrgChartNode({
  name,
  selected,
  nodeType,
  badge,
  badgeColor,
  showHandles = false,
  children,
}: BaseOrgChartNodeProps) {
  const config = orgChartNodeTheme[nodeType];

  return (
    <div
      className={cn(
        'min-w-[140px] max-w-[200px] rounded-lg border bg-card shadow-sm transition-all cursor-pointer',
        selected && 'ring-2 ring-primary shadow-md',
        !selected && 'hover:shadow-md hover:border-primary/50',
        config.border
      )}
    >
      {showHandles && <NodeHandles />}

      {/* Header: name on top, icon + badge below */}
      <div className="flex flex-col gap-1 px-3 py-2">
        <span className="text-sm font-medium truncate leading-tight">{name}</span>
        <div className="flex items-center gap-1.5">
          <IconBadge nodeType={nodeType} />
          {badge && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full inline-block',
                badgeColor || 'bg-muted text-muted-foreground'
              )}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      {children}
    </div>
  );
});

export default BaseOrgChartNode;
