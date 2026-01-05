'use client';

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type Position,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkflowEdgeData } from '../types';

interface DeletableEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  style?: React.CSSProperties;
  markerEnd?: string;
  data?: WorkflowEdgeData;
}

/**
 * DeletableEdge - Custom edge with delete button and type-based styling
 */
export function DeletableEdge({
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
}: DeletableEdgeProps) {
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  // Edge styling based on edge data label (set when edge is created)
  // Uses semantic Tailwind colors that work in both light/dark modes
  const getEdgeStyle = (): React.CSSProperties => {
    const edgeType = data?.label;
    switch (edgeType) {
      case 'error':
        return {
          stroke: 'var(--color-destructive, #ef4444)',
          strokeDasharray: '5,5',
        };
      case 'condition':
        return {
          stroke: 'var(--color-primary, #3b82f6)',
        };
      case 'default':
        return {
          stroke: 'var(--color-muted-foreground, #6b7280)',
          strokeDasharray: '3,3',
        };
      case 'success':
      default:
        return {
          stroke: 'var(--color-success, #22c55e)',
        };
    }
  };

  const edgeStyle: React.CSSProperties = {
    ...style,
    ...getEdgeStyle(),
    strokeWidth: 2,
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-5 w-5 rounded-full bg-background border shadow-sm',
              'opacity-0 hover:opacity-100 transition-opacity',
              'hover:bg-destructive hover:text-destructive-foreground'
            )}
            onClick={onEdgeClick}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
