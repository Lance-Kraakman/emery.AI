'use client';

/**
 * StateContainerSelectorField - React Component
 *
 * Custom Puck field that shows available StateBlock containers on the page.
 * Scans the Puck page data to find StateBlock components and their configurations.
 *
 * Features:
 * - Shows container names with variable/flag counts
 * - Validation warning when selected container doesn't exist
 * - Empty state when no StateBlocks on page
 */

import React, { useMemo } from 'react';
import { createUsePuck, FieldLabel } from '@measured/puck';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Box } from 'lucide-react';
import { cn } from '@/lib/utils';

const usePuck = createUsePuck();

interface StateBlockItem {
  name: string;
  variablesCount: number;
  uiStateCount: number;
}

/**
 * Recursively find all StateBlocks in page content
 */
function findStateBlocks(content: unknown[]): StateBlockItem[] {
  const stateBlocks: StateBlockItem[] = [];
  const seenNames = new Set<string>();

  function traverse(items: unknown[]) {
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;

      const typedItem = item as Record<string, unknown>;

      if (typedItem.type === 'StateBlock' && typedItem.props) {
        const props = typedItem.props as Record<string, unknown>;
        const name = props.name as string | undefined;

        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          const variables = props.variables as unknown[] | undefined;
          const uiState = props.uiState as unknown[] | undefined;

          stateBlocks.push({
            name,
            variablesCount: variables?.length || 0,
            uiStateCount: uiState?.length || 0,
          });
        }
      }

      // Traverse props for nested components (slots)
      if (typedItem.props) {
        const props = typedItem.props as Record<string, unknown>;
        for (const val of Object.values(props)) {
          if (Array.isArray(val)) {
            traverse(val);
          }
        }
      }
    }
  }

  traverse(content);
  return stateBlocks;
}

interface StateContainerSelectorFieldProps {
  value: string | undefined;
  onChange: (value: string) => void;
  readOnly?: boolean;
  field: {
    label?: string;
  };
}

export function StateContainerSelectorFieldRenderer({
  value,
  onChange,
  readOnly,
  field,
}: StateContainerSelectorFieldProps) {
  // Access page data via usePuck
  const appStateData = usePuck((s) => s.appState.data);

  // Find all StateBlocks on the page
  const stateBlocks = useMemo(() => {
    if (!appStateData?.content) return [];
    return findStateBlocks(appStateData.content as unknown[]);
  }, [appStateData?.content]);

  // Check if selected value exists
  const selectedExists = !value || stateBlocks.some((sb) => sb.name === value);

  // Get selected block info for display
  const selectedBlock = stateBlocks.find((sb) => sb.name === value);

  // No state blocks on page
  if (stateBlocks.length === 0) {
    return (
      <FieldLabel label={field.label || 'State Container'}>
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>No StateBlocks found. Add a StateBlock to the page first.</span>
        </div>
      </FieldLabel>
    );
  }

  return (
    <FieldLabel label={field.label || 'State Container'}>
      <div className="space-y-1">
        <Select
          value={value || ''}
          onValueChange={onChange}
          disabled={readOnly}
        >
          <SelectTrigger
            className={cn(
              'h-8 text-sm',
              !selectedExists && value && 'border-amber-400'
            )}
          >
            <SelectValue placeholder="Select a state container...">
              {value && (
                <span className="flex items-center gap-2">
                  <Box className="h-3.5 w-3.5" />
                  <span>{value}</span>
                  {selectedBlock && (
                    <span className="text-muted-foreground text-xs">
                      ({selectedBlock.variablesCount} vars,{' '}
                      {selectedBlock.uiStateCount} flags)
                    </span>
                  )}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {stateBlocks.map((sb) => (
              <SelectItem key={sb.name} value={sb.name}>
                <span className="flex items-center gap-2">
                  <Box className="h-3.5 w-3.5" />
                  <span>{sb.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({sb.variablesCount} vars, {sb.uiStateCount} flags)
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Validation warning */}
        {value && !selectedExists && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="h-3 w-3" />
            <span>Container &quot;{value}&quot; not found on page</span>
          </div>
        )}
      </div>
    </FieldLabel>
  );
}
