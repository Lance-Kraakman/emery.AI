'use client';

/**
 * AgentContainerNode Component
 *
 * Container node for an agent that holds its skills, databases, and automations.
 * Uses React Flow's parent/child node system for grouping.
 */

import React, { memo } from 'react';
import { NodeResizer } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Bot, ChevronDown, ChevronRight, Sparkles, Database, Clock } from 'lucide-react';
import { orgChartNodeTheme, orgChartNodeSizes } from '../theme';
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
  const {
    name,
    role,
    status,
    skillCount = 0,
    databaseCount = 0,
    automationCount = 0,
    isExpanded = true,
  } = data;

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

      <div
        className={cn(
          'rounded-xl border-2 transition-all h-full',
          config.bg,
          config.border,
          selected && 'ring-2 ring-primary shadow-lg',
          !selected && 'hover:shadow-md'
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

        {/* Resource counts (always visible) */}
        <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span>{skillCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Database className="h-3 w-3 text-slate-500" />
            <span>{databaseCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-500" />
            <span>{automationCount}</span>
          </div>
        </div>

        {/* Expanded content area (children render here via React Flow) */}
        {isExpanded && (
          <div
            className="relative px-2 py-2"
            style={{
              minHeight: orgChartNodeSizes.containerMinHeight - 90,
            }}
          >
            {/* Placeholder when empty */}
            {skillCount + databaseCount + automationCount === 0 && (
              <div className="absolute inset-4 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Drop skills or databases here
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
});

export default AgentContainerNode;
