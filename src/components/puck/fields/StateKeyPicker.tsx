'use client';

/**
 * StateKeyPicker - Dropdown for selecting UI flags and state variables
 *
 * Used by ConditionalBlock and DialogBlock for selecting state keys.
 * Gets available options from PageStateConfig via StateContext.
 */

import React from 'react';
import { useStateContext } from '../contexts/StateContext';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleLeft, Box } from 'lucide-react';

export type StateKeyType = 'uiFlag' | 'variable' | 'all';

interface StateKeyPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Filter to show only UI flags, only variables, or all */
  keyType?: StateKeyType;
  disabled?: boolean;
}

export function StateKeyPicker({
  value,
  onChange,
  placeholder = 'Select...',
  keyType = 'all',
  disabled = false,
}: StateKeyPickerProps) {
  const stateContext = useStateContext();
  const config = stateContext?.getConfig();

  const uiFlags = config?.uiFlags || [];
  const variables = config?.variables || [];

  const showFlags = keyType === 'all' || keyType === 'uiFlag';
  const showVars = keyType === 'all' || keyType === 'variable';

  const hasOptions = (showFlags && uiFlags.length > 0) || (showVars && variables.length > 0);

  if (!hasOptions) {
    const typeLabel = keyType === 'uiFlag' ? 'UI flags' : keyType === 'variable' ? 'variables' : 'state keys';
    return (
      <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/20">
        No {typeLabel} defined.
        <br />
        <span className="text-[10px]">Add them in the Page State panel.</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showFlags && uiFlags.length > 0 && (
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1.5 text-xs">
              <ToggleLeft className="h-3 w-3" />
              UI Flags
            </SelectLabel>
            {uiFlags.map((flag) => (
              <SelectItem key={flag.name} value={flag.name}>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1 rounded">{flag.name}</code>
                  {flag.description && (
                    <span className="text-xs text-muted-foreground">{flag.description}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {showVars && variables.length > 0 && (
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1.5 text-xs">
              <Box className="h-3 w-3" />
              Variables
            </SelectLabel>
            {variables.map((variable) => (
              <SelectItem key={variable.name} value={variable.name}>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1 rounded">{variable.name}</code>
                  <span className="text-xs text-muted-foreground">({variable.type})</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

export default StateKeyPicker;
