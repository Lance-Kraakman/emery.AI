'use client';

/**
 * VariablesPanel - Clickable panel for inserting variables into text inputs
 *
 * Displays a list of available variables with optional sample values.
 * Clicking a variable calls onInsert with the formatted variable string.
 *
 * Used by:
 * - TriggerConfigModal (database trigger task instructions)
 * - ActionsFieldRenderer (navigate to page query params)
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface Variable {
  /** Variable name, e.g., "id", "row.fieldName", "params.client_id" */
  name: string;
  /** Sample value to display, e.g., "123", "John Doe" */
  sampleValue?: string;
  /** Optional description shown on hover */
  description?: string;
}

export interface VariablesPanelProps {
  /** List of available variables */
  variables: Variable[];
  /** Called when a variable is clicked, receives formatted string like "{id}" */
  onInsert: (formattedVariable: string) => void;
  /** Format function for variable insertion. Default: (name) => `{${name}}` */
  formatVariable?: (name: string) => string;
  /** Show loading state */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Max height with scroll */
  maxHeight?: string;
  /** Empty state message */
  emptyMessage?: string;
}

export function VariablesPanel({
  variables,
  onInsert,
  formatVariable = (name) => `{${name}}`,
  loading = false,
  className,
  maxHeight = '180px',
  emptyMessage = 'No variables available',
}: VariablesPanelProps) {
  if (loading) {
    return (
      <div className={cn('p-3 bg-muted/50 rounded-lg border flex items-center justify-center text-xs text-muted-foreground', className)}>
        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
        Loading variables...
      </div>
    );
  }

  if (variables.length === 0) {
    return (
      <div className={cn('p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground text-center', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn('p-2.5 bg-muted/50 rounded-lg border overflow-y-auto', className)}
      style={{ maxHeight }}
    >
      <div className="space-y-0.5">
        {variables.map((variable) => (
          <button
            key={variable.name}
            type="button"
            className="w-full flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/80 p-1.5 rounded transition-colors text-left"
            onMouseDown={(e) => {
              console.log('🟣 VariablesPanel button mousedown for:', variable.name);
              e.preventDefault(); // Prevents input blur so variable can be inserted at cursor
              e.stopPropagation(); // Prevents Puck from capturing this event
              console.log('🟣 Calling onInsert with:', formatVariable(variable.name));
              onInsert(formatVariable(variable.name));
            }}
            onClick={(e) => {
              console.log('🟣 VariablesPanel button onClick for:', variable.name);
              e.stopPropagation();
            }}
            title={variable.description || `Click to insert ${formatVariable(variable.name)}`}
          >
            <span className="font-mono text-muted-foreground min-w-[100px] flex-shrink-0 truncate">
              {formatVariable(variable.name)}
            </span>
            {variable.sampleValue !== undefined && (
              <>
                <span className="text-muted-foreground/60 flex-shrink-0">→</span>
                <span className="font-mono text-foreground truncate">
                  {variable.sampleValue}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default VariablesPanel;
