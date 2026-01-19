'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type VariableSource = 'input' | 'context' | 'default';

interface VariableChipProps {
  name: string;
  variant?: VariableSource;
  className?: string;
}

/**
 * Renders a variable placeholder as a colored inline badge.
 *
 * Variants:
 * - input (green): Variables from skill inputs
 * - context (blue): Variables from discovered context/data sources
 * - default (gray): Unknown/other variables
 */
export function VariableChip({ name, variant = 'default', className }: VariableChipProps) {
  const variantStyles: Record<VariableSource, string> = {
    input: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
    context: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700',
    default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium border',
        variantStyles[variant],
        className
      )}
    >
      {name}
    </span>
  );
}
