'use client';

/**
 * DocumentIdSourceField - Page variable or static value selector for document ID
 *
 * Similar to SingleRowFilterField but simplified for document ID selection.
 * Features:
 * - RadioGroup toggle: Page Variable / Static Value
 * - Combobox for page variables (can create new)
 * - Text input for static document ID
 */

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStateContext } from '../contexts/StateContext';
import type { DocumentIdSourceConfig } from '../blocks/EditorBlock/types';

/** Regex to extract variable name from {state.varName} format */
const STATE_VAR_REGEX = /\{state\.(\w+)\}/;

/** Parse variable name from {state.varName} format */
function parseStateVariable(value: string): string {
  const match = value.match(STATE_VAR_REGEX);
  return match?.[1] || '';
}

/** Format variable name to {state.varName} format */
function formatStateVariable(varName: string): string {
  return `{state.${varName}}`;
}

/** Default configuration */
const DEFAULT_CONFIG: DocumentIdSourceConfig = {
  valueType: 'variable',
  value: '',
};

interface DocumentIdSourceFieldProps {
  value?: DocumentIdSourceConfig;
  onChange: (value: DocumentIdSourceConfig) => void;
  readOnly?: boolean;
}

export function DocumentIdSourceField({
  value,
  onChange,
  readOnly = false,
}: DocumentIdSourceFieldProps) {
  const [varComboOpen, setVarComboOpen] = useState(false);
  const [newVarInput, setNewVarInput] = useState('');

  const stateContext = useStateContext();
  const pageStateConfig = stateContext?.getConfig();
  const stateVariables = pageStateConfig?.variables || [];

  // Initialize with defaults
  const config: DocumentIdSourceConfig = value ?? DEFAULT_CONFIG;

  // Handle value type change
  const handleValueTypeChange = (type: 'variable' | 'static') => {
    onChange({ ...config, valueType: type, value: '' });
  };

  // Handle variable selection
  const handleSelectVariable = (varName: string) => {
    onChange({
      ...config,
      valueType: 'variable',
      value: formatStateVariable(varName),
    });
    setVarComboOpen(false);
    setNewVarInput('');
  };

  // Handle static value change
  const handleStaticValueChange = (val: string) => {
    onChange({ ...config, value: val });
  };

  // Extract variable name from value
  const currentVarName = config.valueType === 'variable'
    ? parseStateVariable(config.value)
    : '';

  return (
    <div className="space-y-3 p-3 border rounded-md bg-muted/20">
      <Label className="text-xs font-medium">Document ID Source</Label>

      {/* Value Type Toggle */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Source Type</Label>
        <RadioGroup
          value={config.valueType}
          onValueChange={(v) => handleValueTypeChange(v as 'variable' | 'static')}
          className="flex gap-4"
          disabled={readOnly}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="variable" id="doc-variable" className="h-3 w-3" />
            <Label htmlFor="doc-variable" className="text-xs font-normal cursor-pointer">
              Page Variable
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="static" id="doc-static" className="h-3 w-3" />
            <Label htmlFor="doc-static" className="text-xs font-normal cursor-pointer">
              Static Value
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Value Input */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">
          {config.valueType === 'variable' ? 'Variable Name' : 'Document ID'}
        </Label>

        {config.valueType === 'variable' ? (
          /* Combobox for Page Variables */
          <Popover open={varComboOpen} onOpenChange={setVarComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={varComboOpen}
                className="w-full justify-between h-8 text-xs font-normal"
                disabled={readOnly}
              >
                {currentVarName ? formatStateVariable(currentVarName) : 'Select variable...'}
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search variables..."
                  className="h-8 text-xs"
                  value={newVarInput}
                  onValueChange={setNewVarInput}
                />
                <CommandList>
                  <CommandEmpty>
                    <span className="text-xs text-muted-foreground">
                      No variables found. Add them in Page State panel.
                    </span>
                  </CommandEmpty>
                  <CommandGroup heading="State Variables">
                    {stateVariables.map(variable => (
                      <CommandItem
                        key={variable.name}
                        value={variable.name}
                        onSelect={() => handleSelectVariable(variable.name)}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-3 w-3',
                            currentVarName === variable.name ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {formatStateVariable(variable.name)}
                        {variable.description && (
                          <span className="ml-2 text-muted-foreground truncate">
                            {variable.description}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          /* Static Value Input */
          <Input
            value={config.value}
            onChange={(e) => handleStaticValueChange(e.target.value)}
            placeholder="Enter document ID..."
            className="h-8 text-xs"
            disabled={readOnly}
          />
        )}
      </div>

      {/* Help text */}
      <p className="text-[10px] text-muted-foreground">
        {config.valueType === 'variable'
          ? 'Uses a state variable (auto-populated from URL params)'
          : 'Enter a fixed document ID to always display'}
      </p>
    </div>
  );
}

export default DocumentIdSourceField;
