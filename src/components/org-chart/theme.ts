/**
 * Org Chart Canvas Theme
 *
 * Centralized theme configuration for org chart nodes.
 * Extends workflow-canvas theme patterns with entity-specific styling.
 */

import {
  Bot,
  Sparkles,
  Database,
  Folder,
  StickyNote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OrgChartNodeType } from './types';

/**
 * Node theme configuration
 */
export interface OrgChartNodeThemeConfig {
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
  /** Header background for container nodes */
  headerBg?: string;
}

/**
 * Theme configuration for each org chart node type
 */
export const orgChartNodeTheme: Record<OrgChartNodeType, OrgChartNodeThemeConfig> = {
  agent: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    border: 'border-emerald-300 dark:border-emerald-700',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: Bot,
    headerBg: 'bg-emerald-100 dark:bg-emerald-900',
  },
  skill: {
    bg: 'bg-violet-50 dark:bg-violet-950',
    border: 'border-violet-300 dark:border-violet-700',
    text: 'text-violet-700 dark:text-violet-300',
    icon: Sparkles,
  },
  database: {
    bg: 'bg-slate-50 dark:bg-slate-900',
    border: 'border-slate-300 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    icon: Database,
  },
  sticky: {
    bg: 'bg-yellow-100 dark:bg-yellow-900',
    border: 'border-yellow-300 dark:border-yellow-700',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: StickyNote,
  },
  org_resources: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
    icon: Folder,
    headerBg: 'bg-blue-100 dark:bg-blue-900',
  },
} as const;

/**
 * Sticky note color themes (matching workflow-canvas)
 */
export const stickyNoteColors = {
  yellow: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/50',
    border: 'border-yellow-300 dark:border-yellow-700',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/50',
    border: 'border-blue-300 dark:border-blue-700',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-900/50',
    border: 'border-green-300 dark:border-green-700',
  },
  pink: {
    bg: 'bg-pink-100 dark:bg-pink-900/50',
    border: 'border-pink-300 dark:border-pink-700',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/50',
    border: 'border-purple-300 dark:border-purple-700',
  },
} as const;

export type StickyNoteColor = keyof typeof stickyNoteColors;

/**
 * Handle styling for org chart nodes
 */
export const orgChartHandles = {
  /** Style for source handles (outgoing connections) */
  referenceSource: { className: '!bg-violet-500 !w-2 !h-2' },
  /** Style for target handles (incoming connections) */
  referenceTarget: { className: '!bg-violet-500 !w-2 !h-2' },
} as const;

/**
 * Node size constants (n8n-style compact nodes)
 */
export const orgChartNodeSizes = {
  /** Standard node width for resource nodes */
  nodeWidth: 140,
  /** Compact node height */
  nodeHeight: 52,
  /** Container node minimum width */
  containerMinWidth: 260,
  /** Container node minimum height */
  containerMinHeight: 120,
  /** Padding inside container nodes */
  containerPadding: 12,
  /** Gap between child nodes inside container */
  childNodeGap: 12,
  /** Height of agent container header (main header + resource counts bar) */
  containerHeaderHeight: 56,
  /** Gap between sections (skills and databases) inside agent */
  sectionGap: 16,
  /** Height of section label */
  sectionLabelHeight: 20,
} as const;

/**
 * Edge styles for different relationship types
 */
export const orgChartEdgeStyles = {
  containment: {
    stroke: '#94a3b8', // slate-400
    strokeWidth: 1,
    strokeDasharray: '4 4',
  },
  automation_skill: {
    stroke: '#f59e0b', // amber-500
    strokeWidth: 2,
    animated: true,
  },
  skill_ref: {
    stroke: '#8b5cf6', // violet-500
    strokeWidth: 2,
  },
  skill_table: {
    stroke: '#06b6d4', // cyan-500
    strokeWidth: 2,
    strokeDasharray: '6 3',
  },
  data_source: {
    stroke: '#10b981', // emerald-500
    strokeWidth: 2,
    strokeDasharray: '3 3',
  },
} as const;

/**
 * Get display label for node type
 */
export function getNodeTypeLabel(type: OrgChartNodeType): string {
  const labels: Record<OrgChartNodeType, string> = {
    agent: 'Agent',
    skill: 'Skill',
    database: 'Database',
    sticky: 'Note',
    org_resources: 'Organization',
  };
  return labels[type];
}

/**
 * Get badge color for skill execution type
 */
export function getSkillTypeBadgeColor(executionType?: string): string {
  const colors: Record<string, string> = {
    agentic: 'bg-violet-200 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    tool: 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200',
    read: 'bg-cyan-200 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    write: 'bg-pink-200 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    operation: 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };
  return colors[executionType || 'agentic'] || colors.agentic;
}
