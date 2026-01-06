'use client';

/**
 * BaseNode Component
 *
 * Compact n8n-style node - just icon + name.
 * All configuration is done via the side panel.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
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
    <div className={cn('flex h-5 w-5 items-center justify-center rounded', config.bg)}>
      <Icon className={cn('h-3 w-3', config.text)} />
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
  /**
   * Output handle configuration:
   * - 'standard': success/error handles (default)
   * - 'none': no output handles
   * - Array: custom handle configuration
   */
  outputHandles?: 'standard' | 'none' | CustomHandleConfig[];
  /** Whether this node is disabled (skipped during execution) */
  isDisabled?: boolean;
}

/**
 * BaseNode - Compact n8n-style node
 *
 * Shows only icon + name. All details in side panel.
 */
export const BaseNode = memo(function BaseNode({
  name,
  selected,
  theme,
  outputHandles = 'standard',
  isDisabled = false,
}: BaseNodeProps) {
  const themeConfig = nodeTheme[theme];

  return (
    <div
      className={cn(
        'w-[140px] rounded-lg border bg-card shadow-sm transition-all',
        selected && 'ring-2 ring-primary shadow-md',
        !selected && 'hover:shadow-md',
        isDisabled && 'opacity-50 border-dashed'
      )}
    >
      {/* Input handle - always present */}
      <Handle
        type={standardHandles.input.type}
        position={standardHandles.input.position}
        className={standardHandles.input.className}
      />

      {/* Compact content: icon + name */}
      <div className="flex items-center gap-2 px-3 py-2">
        <IconBadge theme={theme} />
        <span className="text-xs font-medium truncate flex-1">{name}</span>
      </div>

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
    </div>
  );
});
