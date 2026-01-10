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
import { orgChartNodeTheme, orgChartHandles, type OrgChartNodeThemeConfig } from '../theme';
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
  /** Whether node is inside a container (affects positioning) */
  isChild?: boolean;
  /** Optional onClick handler */
  onClick?: () => void;
  /** Optional double-click handler (e.g., open editor) */
  onDoubleClick?: () => void;
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
  isChild = false,
  onClick,
  onDoubleClick,
}: BaseOrgChartNodeProps) {
  const config = orgChartNodeTheme[nodeType];

  return (
    <div
      className={cn(
        'min-w-[180px] max-w-[240px] rounded-lg border bg-card shadow-sm transition-all cursor-pointer',
        selected && 'ring-2 ring-primary shadow-md',
        !selected && 'hover:shadow-md hover:border-primary/50',
        config.border
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Handles for connections (usually hidden for child nodes) */}
      {showHandles && !isChild && (
        <>
          <Handle
            type={orgChartHandles.referenceTarget.type}
            position={orgChartHandles.referenceTarget.position}
            className={orgChartHandles.referenceTarget.className}
          />
          <Handle
            type={orgChartHandles.referenceSource.type}
            position={orgChartHandles.referenceSource.position}
            className={orgChartHandles.referenceSource.className}
          />
        </>
      )}

      {/* Compact content: icon + name + badge */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <IconBadge nodeType={nodeType} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <span className="text-sm font-medium truncate block leading-tight">{name}</span>
          {badge && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full inline-block mt-1',
                badgeColor || 'bg-muted text-muted-foreground'
              )}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default BaseOrgChartNode;
