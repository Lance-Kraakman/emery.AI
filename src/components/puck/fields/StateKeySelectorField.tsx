'use client';

/**
 * StateKeySelectorField - React Component
 *
 * Custom Puck field that shows available variables or UI state flags
 * from a selected StateBlock container.
 *
 * Features:
 * - Filters keys by type (variables, uiState, or all)
 * - Groups options with section headers
 * - Shows type info and default values
 * - Validation warnings when key doesn't exist
 */

import React, { useMemo } from 'react';
import { createUsePuck, FieldLabel } from '@measured/puck';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Variable, ToggleLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StateVariable, UIStateFlag } from '../types/state';

const usePuck = createUsePuck();

export type StateKeyFilterType = 'variables' | 'uiState' | 'all';

interface StateBlockData {
  name: string;
  variables: StateVariable[];
  uiState: UIStateFlag[];
}

/**
 * Find a specific StateBlock by name in page content
 */
function findStateBlockByName(
  content: unknown[],
  containerName: string
): StateBlockData | null {
  function traverse(items: unknown[]): StateBlockData | null {
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;

      const typedItem = item as Record<string, unknown>;

      if (typedItem.type === 'StateBlock' && typedItem.props) {
        const props = typedItem.props as Record<string, unknown>;
        if (props.name === containerName) {
          return {
            name: containerName,
            variables: (props.variables as StateVariable[]) || [],
            uiState: (props.uiState as UIStateFlag[]) || [],
          };
        }
      }

      // Traverse props for nested components (slots)
      if (typedItem.props) {
        const props = typedItem.props as Record<string, unknown>;
        for (const val of Object.values(props)) {
          if (Array.isArray(val)) {
            const found = traverse(val);
            if (found) return found;
          }
        }
      }
    }
    return null;
  }

  return traverse(content);
}

interface StateKeySelectorFieldProps {
  value: string | undefined;
  onChange: (value: string) => void;
  readOnly?: boolean;
  field: {
    label?: string;
    containerProp: string; // Name of the prop that holds container name
    filterType: StateKeyFilterType;
  };
}

export function StateKeySelectorFieldRenderer({
  value,
  onChange,
  readOnly,
  field,
}: StateKeySelectorFieldProps) {
  // Access page data and selected item via usePuck
  const appStateData = usePuck((s) => s.appState.data);
  const selectedItem = usePuck((s) => s.selectedItem);

  // Get the container name from the selected item's props
  const containerName = useMemo(() => {
    if (!selectedItem?.props) return undefined;
    const props = selectedItem.props as Record<string, unknown>;
    return props[field.containerProp] as string | undefined;
  }, [selectedItem?.props, field.containerProp]);

  // Find the StateBlock configuration
  const stateBlock = useMemo(() => {
    if (!containerName || !appStateData?.content) return null;
    return findStateBlockByName(
      appStateData.content as unknown[],
      containerName
    );
  }, [appStateData?.content, containerName]);

  // Get available keys based on filter type
  const { variables, uiState } = useMemo(() => {
    if (!stateBlock) return { variables: [], uiState: [] };

    const vars =
      field.filterType === 'uiState' ? [] : stateBlock.variables;
    const flags =
      field.filterType === 'variables' ? [] : stateBlock.uiState;

    return { variables: vars, uiState: flags };
  }, [stateBlock, field.filterType]);

  const allKeys = [
    ...variables.map((v) => v.name),
    ...uiState.map((f) => f.name),
  ];
  const selectedExists = !value || allKeys.includes(value);

  // Get info about selected key
  const selectedVariable = variables.find((v) => v.name === value);
  const selectedFlag = uiState.find((f) => f.name === value);

  // No container selected
  if (!containerName) {
    return (
      <FieldLabel label={field.label || 'State Key'}>
        <Select disabled>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select a container first..." />
          </SelectTrigger>
        </Select>
      </FieldLabel>
    );
  }

  // Container not found
  if (!stateBlock) {
    return (
      <FieldLabel label={field.label || 'State Key'}>
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Container &quot;{containerName}&quot; not found on page</span>
        </div>
      </FieldLabel>
    );
  }

  // No keys available
  if (allKeys.length === 0) {
    const typeLabel =
      field.filterType === 'all'
        ? 'variables or flags'
        : field.filterType === 'uiState'
          ? 'UI state flags'
          : 'variables';
    return (
      <FieldLabel label={field.label || 'State Key'}>
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-600 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            No {typeLabel} defined in &quot;{containerName}&quot;
          </span>
        </div>
      </FieldLabel>
    );
  }

  return (
    <FieldLabel label={field.label || 'State Key'}>
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
            <SelectValue placeholder="Select a key...">
              {value && (
                <span className="flex items-center gap-2">
                  {selectedVariable ? (
                    <>
                      <Variable className="h-3.5 w-3.5" />
                      <span>{value}</span>
                      <span className="text-muted-foreground text-xs">
                        ({selectedVariable.type})
                      </span>
                    </>
                  ) : selectedFlag ? (
                    <>
                      <ToggleLeft className="h-3.5 w-3.5" />
                      <span>{value}</span>
                      <span className="text-muted-foreground text-xs">
                        (flag)
                      </span>
                    </>
                  ) : (
                    <span>{value}</span>
                  )}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {/* Variables Group */}
            {variables.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground">
                  Variables
                </SelectLabel>
                {variables.map((v) => (
                  <SelectItem key={`var-${v.name}`} value={v.name}>
                    <span className="flex items-center gap-2">
                      <Variable className="h-3.5 w-3.5" />
                      <span>{v.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({v.type})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {/* UI State Group */}
            {uiState.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground">
                  UI State Flags
                </SelectLabel>
                {uiState.map((f) => (
                  <SelectItem key={`flag-${f.name}`} value={f.name}>
                    <span className="flex items-center gap-2">
                      <ToggleLeft className="h-3.5 w-3.5" />
                      <span>{f.name}</span>
                      <span className="text-muted-foreground text-xs">
                        (default: {f.defaultValue ? 'on' : 'off'})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        {/* Validation warning */}
        {value && !selectedExists && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="h-3 w-3" />
            <span>
              Key &quot;{value}&quot; not found in &quot;{containerName}&quot;
            </span>
          </div>
        )}
      </div>
    </FieldLabel>
  );
}
