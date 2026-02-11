'use client';

/**
 * AgentContainerNode Component (Redesigned)
 *
 * Compact agent card with inline skill/database lists.
 * Skills and databases are rendered as list items (like tables in DatabaseNode)
 * instead of separate draggable child nodes.
 */

import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Bot, Sparkles, Database, ArrowUpFromLine } from 'lucide-react';
import { orgChartNodeTheme, orgChartHandles, getSkillTypeBadgeColor } from '../theme';
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
  const router = useRouter();
  const config = orgChartNodeTheme.agent;
  const { dragType, isDragging, onEjectSkill, onEjectDatabase } = useOrgChartDragSafe();
  const {
    name,
    role,
    status,
    skills = [],
    databases = [],
  } = data;

  // Determine if this agent accepts the current drag type
  const canAcceptDrag = isDragging && (dragType === 'skill' || dragType === 'database');

  // Handle skill click - navigate to skill editor
  const handleSkillClick = useCallback((e: React.MouseEvent, skillId: number) => {
    e.stopPropagation();
    router.push(`/skills/${skillId}?returnTo=org-chart`);
  }, [router]);

  // Handle database click - navigate to database
  const handleDatabaseClick = useCallback((e: React.MouseEvent, databaseId: number) => {
    e.stopPropagation();
    router.push(`/data?database=${databaseId}&returnTo=org-chart`);
  }, [router]);

  // Handle skill eject - move to org level
  const handleEjectSkill = useCallback((e: React.MouseEvent, skillId: number) => {
    e.stopPropagation();
    e.preventDefault();
    onEjectSkill?.(skillId);
  }, [onEjectSkill]);

  // Handle database eject - move to org level
  const handleEjectDatabase = useCallback((e: React.MouseEvent, databaseId: number) => {
    e.stopPropagation();
    e.preventDefault();
    onEjectDatabase?.(databaseId);
  }, [onEjectDatabase]);

  return (
    <div
      className={cn(
        'min-w-[180px] max-w-[280px] rounded-lg border bg-card shadow-sm transition-all',
        config.border,
        selected && 'ring-2 ring-primary shadow-md',
        !selected && 'hover:shadow-md hover:border-primary/50',
        // Drag feedback
        canAcceptDrag && 'ring-2 ring-primary/50 border-primary shadow-lg shadow-primary/20'
      )}
    >
      {/* Agent-level handles for LTR layout */}
      <Handle
        id="left-target"
        type="target"
        position={Position.Left}
        className={orgChartHandles.referenceTarget.className}
        style={{ top: 24 }}
      />

      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 border-b',
          config.headerBg,
          config.border
        )}
      >
        {/* Agent icon */}
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg shrink-0', config.bg, config.border, 'border')}>
          <Bot className={cn('h-4 w-4', config.text)} />
        </div>

        {/* Name and role */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{name}</h3>
          {role && <p className="text-[10px] text-muted-foreground truncate">{role}</p>}
        </div>

        {/* Status badge */}
        {status && (
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
              status === 'active'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            )}
          >
            {status}
          </span>
        )}
      </div>

      {/* Skills section */}
      {skills.length > 0 && (
        <div className="border-b border-border/50">
          <div className="px-3 py-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Skills
            </span>
            <span className="text-[10px] text-muted-foreground">({skills.length})</span>
          </div>
          <div className="px-2 pb-2 space-y-0.5">
            {skills.map(skill => (
              <div
                key={skill.id}
                className="relative flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-muted/50 group"
              >
                {/* Skill-level connection handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`skill-${skill.id}`}
                  className={orgChartHandles.referenceSource.className}
                  style={{ right: -4, top: '50%', transform: 'translateY(-50%)' }}
                />
                <button
                  onClick={(e) => handleSkillClick(e, skill.id)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-1 text-left min-w-0"
                >
                  <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
                  <span className="truncate flex-1">{skill.name}</span>
                  {skill.executionType && (
                    <span
                      className={cn(
                        'text-[9px] px-1 py-0.5 rounded shrink-0',
                        getSkillTypeBadgeColor(skill.executionType)
                      )}
                    >
                      {skill.executionType}
                    </span>
                  )}
                </button>
                {/* Eject button - appears on hover */}
                {onEjectSkill && (
                  <button
                    onClick={(e) => handleEjectSkill(e, skill.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded shrink-0 transition-opacity"
                    title="Move to org level"
                  >
                    <ArrowUpFromLine className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Databases section */}
      {databases.length > 0 && (
        <div>
          <div className="px-3 py-1 flex items-center gap-1">
            <Database className="h-3 w-3 text-slate-500" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Databases
            </span>
            <span className="text-[10px] text-muted-foreground">({databases.length})</span>
          </div>
          <div className="px-2 pb-2 space-y-0.5">
            {databases.map(db => (
              <div
                key={db.id}
                className="relative flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-muted/50 group"
              >
                {/* Database-level connection handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`db-${db.id}`}
                  className={orgChartHandles.referenceSource.className}
                  style={{ right: -4, top: '50%', transform: 'translateY(-50%)' }}
                />
                <button
                  onClick={(e) => handleDatabaseClick(e, db.id)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-1 text-left min-w-0"
                >
                  <Database className="h-3 w-3 text-slate-500 shrink-0" />
                  <span className="truncate">{db.name}</span>
                </button>
                {/* Eject button - appears on hover */}
                {onEjectDatabase && (
                  <button
                    onClick={(e) => handleEjectDatabase(e, db.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded shrink-0 transition-opacity"
                    title="Move to org level"
                  >
                    <ArrowUpFromLine className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {skills.length === 0 && databases.length === 0 && (
        <div
          className={cn(
            'flex items-center justify-center py-4 px-3 transition-all',
            canAcceptDrag && 'bg-primary/5'
          )}
        >
          <span className="text-xs text-muted-foreground text-center">
            Drop skills or databases here
          </span>
        </div>
      )}
    </div>
  );
});

export default AgentContainerNode;
