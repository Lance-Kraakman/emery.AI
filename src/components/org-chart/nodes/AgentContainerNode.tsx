'use client';

/**
 * AgentContainerNode Component
 *
 * Container node for an agent that holds its skills and databases.
 * Uses React Flow's parent/child node system for grouping.
 * Single unified content area - no separate sections.
 */

import React, { memo } from 'react';
import { NodeResizer, Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Bot, ChevronDown, ChevronRight, Sparkles, Database } from 'lucide-react';
import { orgChartNodeTheme, orgChartNodeSizes, orgChartHandles } from '../theme';
import { useOrgChartDragSafe } from '../context';
import type { AgentContainerNodeData } from '../types';

interface AgentContainerNodeProps {
  data: AgentContainerNodeData;
  selected: boolean;
}

export const AgentContainerNode = memo(function AgentContainerNode({
  data,
  selected,
}: AgentContainerNodeProps) {
  const config = orgChartNodeTheme.agent;
  const { dragType, isDragging } = useOrgChartDragSafe();
  const {
    name,
    role,
    status,
    skillCount = 0,
    databaseCount = 0,
    isExpanded = true,
  } = data;

  // Determine if this agent accepts the current drag type
  const canAcceptDrag = isDragging && (dragType === 'skill' || dragType === 'database');
  const isEmpty = skillCount === 0 && databaseCount === 0;

  return (
    <>
      {/* Enable resizing */}
      <NodeResizer
        minWidth={orgChartNodeSizes.containerMinWidth}
        minHeight={isExpanded ? orgChartNodeSizes.containerMinHeight : 60}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!w-2 !h-2 !bg-primary !border-primary"
      />

      {/* Connection handles for data source edges */}
      <Handle
        id="right-source"
        type="source"
        position={Position.Right}
        className={orgChartHandles.referenceSource.className}
        style={{ top: 32 }}
      />
      <Handle
        id="left-target"
        type="target"
        position={Position.Left}
        className={orgChartHandles.referenceTarget.className}
        style={{ top: 32 }}
      />

      <div
        className={cn(
          'rounded-xl border-2 transition-all h-full',
          config.bg,
          config.border,
          selected && 'ring-2 ring-primary shadow-lg',
          !selected && 'hover:shadow-md',
          // Drag feedback
          canAcceptDrag && 'ring-2 ring-primary/50 border-primary shadow-lg shadow-primary/20'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-t-xl border-b',
            config.headerBg,
            config.border
          )}
        >
          {/* Expand/Collapse toggle */}
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* Agent icon */}
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bg, config.border, 'border')}>
            <Bot className={cn('h-4 w-4', config.text)} />
          </div>

          {/* Name and role */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{name}</h3>
            {role && <p className="text-xs text-muted-foreground truncate">{role}</p>}
          </div>

          {/* Status badge */}
          {status && (
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                status === 'active'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              {status}
            </span>
          )}
        </div>

        {/* Expanded content area - unified layout */}
        {isExpanded && (
          <div
            className="relative px-4 pb-4 overflow-hidden"
            style={{
              minHeight: orgChartNodeSizes.containerMinHeight - orgChartNodeSizes.containerHeaderHeight,
            }}
          >
            {/* Combined header with counts */}
            <div className="flex items-center gap-3 mb-2 mt-2">
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-violet-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Skills
                </span>
                <span className="text-[10px] text-muted-foreground">({skillCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3 text-slate-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Databases
                </span>
                <span className="text-[10px] text-muted-foreground">({databaseCount})</span>
              </div>
            </div>

            {/* Empty state message - shown when no skills or databases */}
            {isEmpty && (
              <div
                className={cn(
                  'flex items-center justify-center rounded-lg border-2 border-dashed transition-all py-6 px-4',
                  canAcceptDrag
                    ? 'border-primary bg-primary/5 scale-[1.02]'
                    : 'border-muted-foreground/20'
                )}
              >
                <span className="text-xs text-muted-foreground text-center">
                  Drop Skills and Databases to assign them to agent ownership
                </span>
              </div>
            )}

            {/* Content area for child nodes (React Flow handles positioning) */}
            {!isEmpty && (
              <div className="min-h-[40px]">
                {/* Child skill and database nodes are rendered by React Flow */}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
});

export default AgentContainerNode;
