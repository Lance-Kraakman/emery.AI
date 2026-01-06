'use client';

/**
 * ReferenceEdge Component
 *
 * Custom edge for showing relationships in the org chart.
 * Styled based on edge type (skill_ref, automation_skill, skill_table).
 */

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Position,
} from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { OrgChartEdgeData, OrgChartEdgeType } from '../types';

interface ReferenceEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  style?: React.CSSProperties;
  markerEnd?: string;
  data?: OrgChartEdgeData;
  selected?: boolean;
}

/**
 * Get edge style based on edge type
 */
function getEdgeStyle(edgeType?: OrgChartEdgeType): React.CSSProperties {
  switch (edgeType) {
    case 'skill_ref':
      // Skill references another skill - violet dashed
      return {
        stroke: '#8b5cf6', // violet-500
        strokeDasharray: '5,5',
      };
    case 'automation_skill':
      // Automation triggers skill - amber solid
      return {
        stroke: '#f59e0b', // amber-500
      };
    case 'skill_table':
      // Skill reads/writes to table - cyan dotted
      return {
        stroke: '#06b6d4', // cyan-500
        strokeDasharray: '2,2',
      };
    case 'containment':
      // Containment relationship - subtle gray
      return {
        stroke: '#94a3b8', // slate-400
        opacity: 0.5,
      };
    default:
      return {
        stroke: '#6b7280', // gray-500
      };
  }
}

/**
 * Get edge label based on type
 */
function getEdgeLabel(edgeType?: OrgChartEdgeType): string | null {
  switch (edgeType) {
    case 'skill_ref':
      return 'references';
    case 'automation_skill':
      return 'triggers';
    case 'skill_table':
      return 'uses';
    default:
      return null;
  }
}

/**
 * ReferenceEdge - Custom edge with type-based styling
 */
export function ReferenceEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: ReferenceEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.edgeType;
  const edgeStyle: React.CSSProperties = {
    ...style,
    ...getEdgeStyle(edgeType),
    strokeWidth: selected ? 3 : 2,
    transition: 'stroke-width 0.2s ease',
  };

  const label = data?.label || getEdgeLabel(edgeType);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span
              className={cn(
                'px-1.5 py-0.5 text-[10px] rounded bg-background/90 backdrop-blur-sm',
                'border shadow-sm text-muted-foreground',
                selected && 'text-foreground font-medium'
              )}
            >
              {label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default ReferenceEdge;
