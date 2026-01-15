'use client';

/**
 * AgentContainerNode Component
 *
 * Container node for an agent that holds its skills, databases, and automations.
 * Uses React Flow's parent/child node system for grouping.
 * Skills are rendered in top section, databases in bottom section.
 */

import React, { memo, useMemo } from 'react';
import { NodeResizer, Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Bot, ChevronDown, ChevronRight, Sparkles, Database, Plus } from 'lucide-react';
import { orgChartNodeTheme, orgChartNodeSizes, orgChartHandles } from '../theme';
import { getAgentSectionLayout } from '../utils';
import { useOrgChartDragSafe } from '../context';
import type { AgentContainerNodeData } from '../types';

interface AgentContainerNodeProps {
  data: AgentContainerNodeData;
  selected: boolean;
}

/**
 * Placeholder slot component for adding new items
 */
function PlaceholderSlot({
  isHighlighted,
  colorClass,
}: {
  isHighlighted: boolean;
  colorClass: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg border-2 border-dashed transition-all',
        isHighlighted
          ? `${colorClass} scale-105`
          : 'border-muted-foreground/20 hover:border-muted-foreground/40'
      )}
      style={{
        width: orgChartNodeSizes.nodeWidth,
        height: 28,
      }}
    >
      <Plus
        className={cn(
          'h-4 w-4 transition-colors',
          isHighlighted ? 'text-current' : 'text-muted-foreground/40'
        )}
      />
    </div>
  );
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

  // Calculate section positions for labels
  const sectionLayout = useMemo(
    () => getAgentSectionLayout(skillCount, databaseCount),
    [skillCount, databaseCount]
  );

  // Determine if this agent accepts the current drag type
  const canAcceptDrag = isDragging && (dragType === 'skill' || dragType === 'database');
  const isDraggingSkill = isDragging && dragType === 'skill';
  const isDraggingDatabase = isDragging && dragType === 'database';

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

        {/* Expanded content area with sections */}
        {isExpanded && (
          <div
            className="relative px-4 pb-4"
            style={{
              minHeight: Math.max(
                orgChartNodeSizes.containerMinHeight - orgChartNodeSizes.containerHeaderHeight,
                sectionLayout.totalHeight - orgChartNodeSizes.containerHeaderHeight
              ),
            }}
          >
            {/* Skills Section */}
            <div className="mb-2">
              {/* Section Header */}
              <div className="flex items-center gap-1.5 mb-2 mt-2">
                <Sparkles className="h-3 w-3 text-violet-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Skills
                </span>
                {skillCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">({skillCount})</span>
                )}
              </div>

              {/* Skills placeholder slot - shown when empty or as drop target */}
              {skillCount === 0 && (
                <PlaceholderSlot
                  isHighlighted={isDraggingSkill}
                  colorClass="border-violet-400 bg-violet-50/50 dark:bg-violet-900/20 text-violet-500"
                />
              )}
            </div>

            {/* Section Divider - only show when both sections have items */}
            {skillCount > 0 && databaseCount > 0 && (
              <div
                className="absolute border-t border-dashed border-muted-foreground/20"
                style={{
                  left: orgChartNodeSizes.containerPadding,
                  right: orgChartNodeSizes.containerPadding,
                  top: sectionLayout.skillsEndY - orgChartNodeSizes.sectionGap / 2,
                }}
              />
            )}

            {/* Databases Section */}
            <div
              style={{
                position: 'absolute',
                left: orgChartNodeSizes.containerPadding,
                right: orgChartNodeSizes.containerPadding,
                top: sectionLayout.databasesStartY,
              }}
            >
              {/* Section Header */}
              <div className="flex items-center gap-1.5 mb-2">
                <Database className="h-3 w-3 text-slate-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Databases
                </span>
                {databaseCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">({databaseCount})</span>
                )}
              </div>

              {/* Databases placeholder slot - shown when empty or as drop target */}
              {databaseCount === 0 && (
                <PlaceholderSlot
                  isHighlighted={isDraggingDatabase}
                  colorClass="border-slate-400 bg-slate-50/50 dark:bg-slate-800/20 text-slate-500"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
});

export default AgentContainerNode;
