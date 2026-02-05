'use client';

import React from 'react';
import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolChipProps {
  /** Raw tool name, e.g. "gmail_send_email" or "row_crud:read" */
  toolName: string;
  /** Optional display name override */
  displayName?: string;
  /** App icon URL from the database (appTypes.iconUrl) */
  iconUrl?: string;
  className?: string;
}

/**
 * Inline chip for tool references in plan steps and tool lists.
 *
 * Purple themed — shows app icon from iconUrl + formatted display name.
 * Falls back to a wrench icon if no iconUrl is provided.
 */
export function ToolChip({ toolName, displayName, iconUrl, className }: ToolChipProps) {
  const label = displayName || formatToolDisplayName(toolName);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border',
        'bg-purple-100 text-purple-700 border-purple-200',
        'dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
        className
      )}
      title={toolName}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={label}
          className="w-3 h-3 rounded-sm object-cover"
          crossOrigin="anonymous"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <Wrench className="w-3 h-3" />
      )}
      {label}
    </span>
  );
}

/**
 * Format a tool name for display.
 * Strips common prefixes and converts underscores to spaces with title case.
 * e.g., "gmail_send_email" -> "Send Email"
 */
function formatToolDisplayName(toolName: string): string {
  const lower = toolName.toLowerCase();

  // Strip common reference prefixes
  for (const prefix of ['@tool:', '@doc:', '@file:', '@agent:', '@table:', '@database:']) {
    if (lower.startsWith(prefix)) {
      return toolName.slice(prefix.length);
    }
  }

  // Try to strip app prefix (first segment before _)
  const idx = lower.indexOf('_');
  const withoutPrefix = idx > 0 ? lower.slice(idx + 1) : lower;

  return withoutPrefix
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
