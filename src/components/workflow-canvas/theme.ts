/**
 * Workflow Canvas Theme
 *
 * Centralized theme configuration for workflow nodes.
 * Provides consistent styling across all node types.
 */

import { Position } from '@xyflow/react';
import {
  Brain,
  Search,
  Database,
  GitBranch,
  Repeat,
  Wrench,
  Zap,
  Link2,
  ArrowRightToLine,
  ArrowLeftFromLine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Node theme configuration
 */
export interface NodeThemeConfig {
  bg: string;
  text: string;
  icon: LucideIcon;
}

/**
 * Theme configuration for each node type
 */
export const nodeTheme = {
  agentic: {
    bg: 'bg-violet-100 dark:bg-violet-900',
    text: 'text-violet-600 dark:text-violet-400',
    icon: Brain,
  },
  read: {
    bg: 'bg-cyan-100 dark:bg-cyan-900',
    text: 'text-cyan-600 dark:text-cyan-400',
    icon: Search,
  },
  write: {
    bg: 'bg-pink-100 dark:bg-pink-900',
    text: 'text-pink-600 dark:text-pink-400',
    icon: Database,
  },
  condition: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-600 dark:text-amber-400',
    icon: GitBranch,
  },
  loop: {
    bg: 'bg-teal-100 dark:bg-teal-900',
    text: 'text-teal-600 dark:text-teal-400',
    icon: Repeat,
  },
  tool: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-600 dark:text-green-400',
    icon: Wrench,
  },
  operation: {
    bg: 'bg-orange-100 dark:bg-orange-900',
    text: 'text-orange-600 dark:text-orange-400',
    icon: Zap,
  },
  skill_ref: {
    bg: 'bg-purple-100 dark:bg-purple-900',
    text: 'text-purple-600 dark:text-purple-400',
    icon: Link2,
  },
  skillInput: {
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-600 dark:text-blue-400',
    icon: ArrowRightToLine,
  },
  skillOutput: {
    bg: 'bg-emerald-100 dark:bg-emerald-900',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: ArrowLeftFromLine,
  },
} as const;

export type NodeThemeKey = keyof typeof nodeTheme;

/**
 * Standard handle configurations
 */
export const standardHandles = {
  input: {
    type: 'target' as const,
    position: Position.Top,
    className: '!bg-muted-foreground !w-3 !h-3',
  },
  success: {
    type: 'source' as const,
    position: Position.Bottom,
    id: 'success',
    className: '!bg-green-500 !w-3 !h-3',
    style: { left: '35%' },
  },
  error: {
    type: 'source' as const,
    position: Position.Bottom,
    id: 'error',
    className: '!bg-red-500 !w-3 !h-3',
    style: { left: '65%' },
  },
} as const;

/**
 * Custom handle configuration for dynamic handles (e.g., ConditionNode)
 */
export interface CustomHandleConfig {
  id: string;
  label?: string;
  color: string;
  offset: string;
}
