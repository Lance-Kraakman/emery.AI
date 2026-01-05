'use client';

/**
 * BaseNode Component
 *
 * Shared wrapper component for all workflow nodes.
 * Eliminates boilerplate duplication across node types.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  nodeTheme,
  standardHandles,
  type NodeThemeKey,
  type CustomHandleConfig,
} from '../theme';

/**
 * IconBadge - Colored icon badge for node headers
 */
interface IconBadgeProps {
  theme: NodeThemeKey;
}

export function IconBadge({ theme }: IconBadgeProps) {
  const config = nodeTheme[theme];
  const Icon = config.icon;

  return (
    <div className={cn('flex h-6 w-6 items-center justify-center rounded', config.bg)}>
      <Icon className={cn('h-3.5 w-3.5', config.text)} />
    </div>
  );
}

/**
 * BaseNode props
 */
interface BaseNodeProps {
  /** Node display name */
  name: string;
  /** Whether this node is selected */
  selected: boolean;
  /** Theme key for styling (determines icon and colors) */
  theme: NodeThemeKey;
  /** Node content */
  children: React.ReactNode;
  /**
   * Output handle configuration:
   * - 'standard': success/error handles (default)
   * - 'none': no output handles
   * - Array: custom handle configuration
   */
  outputHandles?: 'standard' | 'none' | CustomHandleConfig[];
}

/**
 * BaseNode - Shared node wrapper component
 *
 * Provides consistent styling and structure for all workflow nodes:
 * - Input handle at top
 * - Icon badge with node name
 * - Content area
 * - Output handles at bottom
 */
export const BaseNode = memo(function BaseNode({
  name,
  selected,
  theme,
  children,
  outputHandles = 'standard',
}: BaseNodeProps) {
  return (
    <Card
      className={cn(
        'min-w-[200px] max-w-[280px] shadow-md transition-shadow',
        selected && 'ring-2 ring-primary shadow-lg'
      )}
    >
      {/* Input handle - always present */}
      <Handle
        type={standardHandles.input.type}
        position={standardHandles.input.position}
        className={standardHandles.input.className}
      />

      <CardHeader className="p-3 pb-1">
        <div className="flex items-center gap-2">
          <IconBadge theme={theme} />
          <span className="text-sm font-medium truncate">{name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">{children}</CardContent>

      {/* Standard output handles (success/error) */}
      {outputHandles === 'standard' && (
        <>
          <Handle
            type={standardHandles.success.type}
            position={standardHandles.success.position}
            id={standardHandles.success.id}
            className={standardHandles.success.className}
            style={standardHandles.success.style}
          />
          <Handle
            type={standardHandles.error.type}
            position={standardHandles.error.position}
            id={standardHandles.error.id}
            className={standardHandles.error.className}
            style={standardHandles.error.style}
          />
        </>
      )}

      {/* Custom output handles (for ConditionNode, etc.) */}
      {Array.isArray(outputHandles) &&
        outputHandles.map((handle) => (
          <Handle
            key={handle.id}
            type="source"
            position={Position.Bottom}
            id={handle.id}
            className={cn('!w-3 !h-3', handle.color)}
            style={{ left: handle.offset }}
          />
        ))}
    </Card>
  );
});
