'use client';

/**
 * DocumentIdSourceField - Page variable, parent row, or static value selector for document ID
 *
 * Similar to MultiFilterField but simplified for document ID selection.
 * Features:
 * - RadioGroup toggle: Page Variable / Parent Row / Static Value
 * - Combobox for page variables (from state context)
 * - Dropdown for parent row fields (when inside a DataBlock)
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStateContext } from '../contexts/StateContext';
import { useParentRowData } from '../contexts/RowDataContext';
import type { DocumentIdSourceConfig } from '../blocks/EditorBlock/types';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/** Regex to extract variable name from {{state.varName}} format */
const STATE_VAR_REGEX = /\{\{state\.(\w+)\}\}/;

/** Parse variable name from {{state.varName}} format */
function parseStateVariable(value: string): string {
  const match = value.match(STATE_VAR_REGEX);
  return match?.[1] || '';
}

/** Format variable name to {{state.varName}} format */
function formatStateVariable(varName: string): string {
  return `{{state.${varName}}}`;
}

/** Regex to extract field name from {{rowData.fieldName}} format */
const ROW_DATA_VAR_REGEX = /\{\{rowData\.(\w+)\}\}/;

/** Parse field name from {{rowData.fieldName}} format */
function parseRowDataVariable(value: string): string {
  const match = value.match(ROW_DATA_VAR_REGEX);
  return match?.[1] || '';
}

/** Format field name to {{rowData.fieldName}} format */
function formatRowDataVariable(fieldName: string): string {
  return `{{rowData.${fieldName}}}`;
}

/** Default configuration */
const DEFAULT_CONFIG: DocumentIdSourceConfig = {
  valueType: 'variable',
  value: '',
};

interface DocumentIdSourceFieldProps {
  value?: DocumentIdSourceConfig;
  onChange: (value: DocumentIdSourceConfig) => void;
  /** Optional parent fields passed from config (not typically needed, uses context) */
  parentFields?: FieldDTO[];
  readOnly?: boolean;
}

export function DocumentIdSourceField({
  value,
  onChange,
  parentFields: parentFieldsProp = [],
  readOnly = false,
}: DocumentIdSourceFieldProps) {
  const [varComboOpen, setVarComboOpen] = useState(false);
  const [newVarInput, setNewVarInput] = useState('');

  const stateContext = useStateContext();
  const pageStateConfig = stateContext?.getConfig();
  const stateVariables = pageStateConfig?.variables || [];

  // Get parent row data context for {rowData.x} variables
  const parentContext = useParentRowData();

  // Check if we have parent field metadata available
  const hasParentFields = parentContext?.hasParentFields() || parentFieldsProp.length > 0;

  // Use parent fields from context if available, otherwise use prop
  const parentFields = parentContext?.getParentRowData()?.fields || parentFieldsProp;

  // Initialize with defaults
  const config: DocumentIdSourceConfig = value ?? DEFAULT_CONFIG;

  // Handle value type change
  const handleValueTypeChange = (type: 'variable' | 'parentRow' | 'static') => {
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

  // Handle parent field selection
  const handleSelectParentField = (fieldName: string) => {
    onChange({
      ...config,
      valueType: 'parentRow',
      value: formatRowDataVariable(fieldName),
    });
  };

  // Handle static value change
  const handleStaticValueChange = (val: string) => {
    onChange({ ...config, value: val });
  };

  // Extract variable name from value
  const currentVarName = config.valueType === 'variable'
    ? parseStateVariable(config.value)
    : '';

  // Extract parent field name from value
  const currentParentField = config.valueType === 'parentRow'
    ? parseRowDataVariable(config.value)
    : '';

  return (
    <div className="space-y-3 p-3 border rounded-md bg-muted/20">
      <Label className="text-xs font-medium">Document ID Source</Label>

      {/* Value Type Toggle */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Source Type</Label>
        <RadioGroup
          value={config.valueType}
          onValueChange={(v) => handleValueTypeChange(v as 'variable' | 'parentRow' | 'static')}
          className="flex gap-3"
          disabled={readOnly}
        >
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="variable" id="doc-variable" className="h-3 w-3" />
            <Label htmlFor="doc-variable" className="text-[10px] font-normal cursor-pointer">
              Page Variable
            </Label>
          </div>
          {hasParentFields && (
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="parentRow" id="doc-parentRow" className="h-3 w-3" />
              <Label htmlFor="doc-parentRow" className="text-[10px] font-normal cursor-pointer">
                Parent Row
              </Label>
            </div>
          )}
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="static" id="doc-static" className="h-3 w-3" />
            <Label htmlFor="doc-static" className="text-[10px] font-normal cursor-pointer">
              Static Value
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Value Input */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">
          {config.valueType === 'variable' ? 'Variable' :
           config.valueType === 'parentRow' ? 'Parent Field' : 'Document ID'}
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
        ) : config.valueType === 'parentRow' ? (
          /* Parent Field Selector */
          <Select value={currentParentField} onValueChange={handleSelectParentField} disabled={readOnly}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select parent field" />
            </SelectTrigger>
            <SelectContent>
              {parentFields.map(field => (
                <SelectItem key={field.id} value={field.name} className="text-xs">
                  {field.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          : config.valueType === 'parentRow'
          ? 'Uses the document ID from a parent DataBlock row'
          : 'Enter a fixed document ID to always display'}
      </p>
    </div>
  );
}

export default DocumentIdSourceField;
