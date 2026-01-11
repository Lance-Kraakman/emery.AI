'use client';

/**
 * StateKeyPicker - Dropdown for selecting state variables
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
import { Box } from 'lucide-react';

interface StateKeyPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Optional filter for variable type (e.g., 'boolean' for dialogs) */
  filterType?: string;
  disabled?: boolean;
}

export function StateKeyPicker({
  value,
  onChange,
  placeholder = 'Select...',
  filterType,
  disabled = false,
}: StateKeyPickerProps) {
  const stateContext = useStateContext();
  const config = stateContext?.getConfig();

  let variables = config?.variables || [];

  // Optionally filter by type (e.g., 'boolean' for dialogs)
  if (filterType) {
    variables = variables.filter(v => v.type === filterType);
  }

  if (variables.length === 0) {
    return (
      <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/20">
        No state variables defined.
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
        <SelectGroup>
          <SelectLabel className="flex items-center gap-1.5 text-xs">
            <Box className="h-3 w-3" />
            State Variables
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
      </SelectContent>
    </Select>
  );
}

export default StateKeyPicker;
