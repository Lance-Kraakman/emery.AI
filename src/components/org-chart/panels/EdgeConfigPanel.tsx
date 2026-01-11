'use client';

/**
 * EdgeConfigPanel Component
 *
 * Configuration panel for org chart edges.
 * Shows connection info and I/O mapping options based on edge type.
 */

import React from 'react';
import { ArrowRight, Database, Sparkles, LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { OrgChartEdge, OrgChartEdgeData, OrgChartEdgeType } from '../types';

interface EdgeConfigPanelProps {
  edge: OrgChartEdge;
  sourceName: string;
  sourceType: string;
  targetName: string;
  targetType: string;
}

const edgeTypeConfig: Record<
  OrgChartEdgeType,
  { label: string; description: string; color: string }
> = {
  skill_table: {
    label: 'Data Connection',
    description: 'Skill reads from or writes to this database',
    color: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30',
  },
  skill_ref: {
    label: 'Skill Reference',
    description: 'Skill calls another skill during execution',
    color: 'text-violet-500 bg-violet-100 dark:bg-violet-900/30',
  },
  automation_skill: {
    label: 'Automation Trigger',
    description: 'Automation triggers this skill',
    color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30',
  },
  containment: {
    label: 'Containment',
    description: 'Parent-child relationship',
    color: 'text-slate-500 bg-slate-100 dark:bg-slate-900/30',
  },
};

function NodeIcon({ type }: { type: string }) {
  const Icon = type === 'skill' ? Sparkles : type === 'database' ? Database : LinkIcon;
  const colorClass =
    type === 'skill'
      ? 'text-violet-500'
      : type === 'database'
        ? 'text-slate-500'
        : 'text-muted-foreground';
  return <Icon className={cn('h-4 w-4', colorClass)} />;
}

export function EdgeConfigPanel({
  edge,
  sourceName,
  sourceType,
  targetName,
  targetType,
}: EdgeConfigPanelProps) {
  const edgeData = edge.data as OrgChartEdgeData | undefined;
  const edgeType = edgeData?.edgeType ?? 'containment';
  const config = edgeTypeConfig[edgeType];

  return (
    <div className="space-y-4">
      {/* Edge Type Badge */}
      <div>
        <Badge variant="secondary" className={cn('text-xs', config.color)}>
          {config.label}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
      </div>

      {/* Connection Visualization */}
      <div className="p-3 rounded-lg bg-muted/30 border">
        <div className="flex items-center justify-between gap-2">
          {/* Source */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <NodeIcon type={sourceType} />
            <span className="text-sm font-medium truncate">{sourceName}</span>
          </div>

          {/* Arrow */}
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

          {/* Target */}
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-sm font-medium truncate">{targetName}</span>
            <NodeIcon type={targetType} />
          </div>
        </div>
      </div>

      {/* Edge Label */}
      {edgeData?.label && (
        <div className="text-xs text-muted-foreground">
          Relationship: <span className="font-medium">{edgeData.label}</span>
        </div>
      )}

      {/* Field Mapping Section (Placeholder for future implementation) */}
      {edgeType === 'skill_table' && (
        <div className="border-t pt-4">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Field Mappings
          </h4>
          <p className="text-xs text-muted-foreground italic">
            Configure field mappings in the skill editor.
          </p>
        </div>
      )}

      {edgeType === 'skill_ref' && (
        <div className="border-t pt-4">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            I/O Mappings
          </h4>
          <p className="text-xs text-muted-foreground italic">
            Configure input/output mappings in the skill editor.
          </p>
        </div>
      )}
    </div>
  );
}

export default EdgeConfigPanel;
