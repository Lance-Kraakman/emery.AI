'use client';

/**
 * OrgResourcesNode Component
 *
 * Container/section header for organization-level resources.
 * Contains org-scoped skills, databases, and apps.
 */

import React, { memo } from 'react';
import { NodeResizer } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Folder } from 'lucide-react';
import { orgChartNodeTheme, orgChartNodeSizes } from '../theme';
import type { OrgResourcesNodeData } from '../types';

interface OrgResourcesNodeProps {
  data: OrgResourcesNodeData;
  selected: boolean;
}

export const OrgResourcesNode = memo(function OrgResourcesNode({
  data,
  selected,
}: OrgResourcesNodeProps) {
  const config = orgChartNodeTheme.org_resources;
  const { name } = data;

  return (
    <>
      {/* Enable resizing */}
      <NodeResizer
        minWidth={orgChartNodeSizes.containerMinWidth}
        minHeight={orgChartNodeSizes.containerMinHeight}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!w-2 !h-2 !bg-primary !border-primary"
      />

      <div
        className={cn(
          'rounded-xl border-2 border-dashed transition-all h-full',
          config.bg,
          config.border,
          selected && 'ring-2 ring-primary shadow-lg',
          !selected && 'hover:shadow-md'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-t-xl border-b border-dashed',
            config.headerBg,
            config.border
          )}
        >
          {/* Icon */}
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bg, config.border, 'border')}>
            <Folder className={cn('h-4 w-4', config.text)} />
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{name}</h3>
            <p className="text-xs text-muted-foreground">Shared across all agents</p>
          </div>
        </div>

        {/* Content area */}
        <div
          className="relative px-2 py-2"
          style={{
            minHeight: orgChartNodeSizes.containerMinHeight - 70,
          }}
        >
          {/* Children render here via React Flow */}
        </div>
      </div>
    </>
  );
});

export default OrgResourcesNode;
