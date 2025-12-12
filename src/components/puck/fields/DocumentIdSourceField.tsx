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
import { usePageVariablesContext } from '../contexts/PageVariablesContext';
import type { PageVariable } from '@/components/puck/types';
import type { DocumentIdSourceConfig } from '../blocks/EditorBlock/types';

/** Regex to extract variable name from {params.varName} format */
const PARAMS_VAR_REGEX = /\{params\.(\w+)\}/;

/** Parse variable name from {params.varName} format */
function parseParamVariable(value: string): string {
  const match = value.match(PARAMS_VAR_REGEX);
  return match?.[1] || '';
}

/** Format variable name to {params.varName} format */
function formatParamVariable(varName: string): string {
  return `{params.${varName}}`;
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

  const { pageVariables, addPageVariable } = usePageVariablesContext();

  // Initialize with defaults
  const config: DocumentIdSourceConfig = value ?? DEFAULT_CONFIG;

  // Handle value type change
  const handleValueTypeChange = (type: 'variable' | 'static') => {
    onChange({ ...config, valueType: type, value: '' });
  };

  // Handle variable selection
  const handleSelectVariable = async (varName: string) => {
    // Check if this is a new variable
    const exists = pageVariables.some(v => v.name === varName);

    if (!exists && addPageVariable) {
      const newVar: PageVariable = {
        name: varName,
        type: 'string',
        required: true,
        description: 'Document ID for EditorBlock',
      };

      await addPageVariable(newVar);
    }

    onChange({
      ...config,
      valueType: 'variable',
      value: formatParamVariable(varName),
    });
    setVarComboOpen(false);
    setNewVarInput('');
  };

  // Handle static value change
  const handleStaticValueChange = (val: string) => {
    onChange({ ...config, value: val });
  };

  // Handle creating new variable from input
  const handleCreateNewVariable = () => {
    if (newVarInput.trim()) {
      // Sanitize: only allow alphanumeric and underscore
      const sanitized = newVarInput.trim().replace(/[^a-zA-Z0-9_]/g, '_');
      handleSelectVariable(sanitized);
    }
  };

  // Extract variable name from value
  const currentVarName = config.valueType === 'variable'
    ? parseParamVariable(config.value)
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
                {currentVarName ? formatParamVariable(currentVarName) : 'Select or create variable...'}
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search or type new..."
                  className="h-8 text-xs"
                  value={newVarInput}
                  onValueChange={setNewVarInput}
                />
                <CommandList>
                  <CommandEmpty>
                    {newVarInput.trim() ? (
                      <button
                        className="flex items-center gap-2 px-2 py-1.5 text-xs w-full hover:bg-accent rounded cursor-pointer"
                        onClick={handleCreateNewVariable}
                      >
                        <Plus className="h-3 w-3" />
                        Create "{newVarInput.trim()}"
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Type to create new variable
                      </span>
                    )}
                  </CommandEmpty>
                  <CommandGroup heading="Page Variables">
                    {pageVariables.map(pv => (
                      <CommandItem
                        key={pv.name}
                        value={pv.name}
                        onSelect={() => handleSelectVariable(pv.name)}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-3 w-3',
                            currentVarName === pv.name ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {formatParamVariable(pv.name)}
                        {pv.description && (
                          <span className="ml-2 text-muted-foreground truncate">
                            {pv.description}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {/* Option to create new if input doesn't match existing */}
                  {newVarInput.trim() && !pageVariables.some(v => v.name === newVarInput.trim()) && (
                    <CommandGroup heading="Create New">
                      <CommandItem
                        value={`create-${newVarInput}`}
                        onSelect={handleCreateNewVariable}
                        className="text-xs"
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Create "{newVarInput.trim()}"
                      </CommandItem>
                    </CommandGroup>
                  )}
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
          ? 'Uses a URL parameter (e.g., ?documentId=abc123)'
          : 'Enter a fixed document ID to always display'}
      </p>
    </div>
  );
}

export default DocumentIdSourceField;
