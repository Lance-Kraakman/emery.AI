'use client';

/**
 * SingleRowFilterField - Custom Puck field for DataBlock single mode row selection
 *
 * Provides a filter configuration UI for selecting a single row:
 * - Field selector (from table fields)
 * - Operator selector (based on field type)
 * - Value type toggle (Page Variable or Static)
 * - Value input (combobox for vars, text for static)
 *
 * Auto-creates page variables when a new variable name is entered.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFields } from '@/app/actions/fields';
import { getView } from '@/app/actions/views';
import { usePageVariablesContext } from '../contexts/PageVariablesContext';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { PageVariable } from '@/components/puck/types';
import {
  type FilterOperator,
  type FieldType,
  OPERATORS_BY_FIELD_TYPE,
  TEXT_OPERATORS,
  operatorNeedsValue,
} from '@/lib/types/filters';

/**
 * The filter configuration stored in DataBlock props
 */
export interface SingleRowFilterConfig {
  field: string;
  operator: FilterOperator;
  valueType: 'variable' | 'static';
  value: string;
}

interface SingleRowFilterFieldProps {
  value?: SingleRowFilterConfig;
  onChange: (value: SingleRowFilterConfig) => void;
  /** viewId passed from resolveFields closure */
  viewId?: number;
}

export function SingleRowFilterField({
  value,
  onChange,
  viewId,
}: SingleRowFilterFieldProps) {
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [varComboOpen, setVarComboOpen] = useState(false);
  const [newVarInput, setNewVarInput] = useState('');

  const { pageVariables, addPageVariable } = usePageVariablesContext();

  // Initialize with defaults
  const filterValue: SingleRowFilterConfig = value ?? {
    field: '',
    operator: 'eq',
    valueType: 'variable',
    value: '',
  };

  // Load fields when viewId changes
  useEffect(() => {
    async function loadFields() {
      if (!viewId) {
        setFields([]);
        return;
      }

      setLoadingFields(true);
      try {
        const view = await getView(viewId);
        if (view?.tableId) {
          // getFields now includes id as the first field
          const tableFields = await getFields(view.tableId);
          setFields(tableFields);
        }
      } catch (error) {
        console.error('Failed to load fields:', error);
      } finally {
        setLoadingFields(false);
      }
    }

    loadFields();
  }, [viewId]);

  // Get selected field info
  const selectedField = useMemo(() => {
    return fields.find(f => f.name === filterValue.field);
  }, [fields, filterValue.field]);

  // Get available operators based on field type
  const availableOperators = useMemo(() => {
    const fieldType = (selectedField?.type as FieldType) || 'text';
    return OPERATORS_BY_FIELD_TYPE[fieldType] || TEXT_OPERATORS;
  }, [selectedField]);

  // Handle field change
  const handleFieldChange = (fieldName: string) => {
    onChange({ ...filterValue, field: fieldName });
  };

  // Handle operator change
  const handleOperatorChange = (op: string) => {
    onChange({ ...filterValue, operator: op as FilterOperator });
  };

  // Handle value type change
  const handleValueTypeChange = (type: 'variable' | 'static') => {
    onChange({ ...filterValue, valueType: type, value: '' });
  };

  // Handle variable selection
  const handleSelectVariable = async (varName: string) => {
    // Check if this is a new variable
    const exists = pageVariables.some(v => v.name === varName);

    if (!exists && addPageVariable) {
      // Infer type from field
      const varType = selectedField?.type === 'number' ? 'number' : 'string';

      const newVar: PageVariable = {
        name: varName,
        type: varType as 'string' | 'number',
        required: true,
        description: `Used by DataBlock filter on ${selectedField?.name || 'unknown field'}`,
      };

      await addPageVariable(newVar);
    }

    onChange({
      ...filterValue,
      valueType: 'variable',
      value: `{params.${varName}}`,
    });
    setVarComboOpen(false);
    setNewVarInput('');
  };

  // Handle static value change
  const handleStaticValueChange = (val: string) => {
    onChange({ ...filterValue, value: val });
  };

  // Handle creating new variable from input
  const handleCreateNewVariable = () => {
    if (newVarInput.trim()) {
      // Sanitize: only allow alphanumeric and underscore
      const sanitized = newVarInput.trim().replace(/[^a-zA-Z0-9_]/g, '_');
      handleSelectVariable(sanitized);
    }
  };

  // Extract variable name from value (e.g., "{params.client_id}" -> "client_id")
  const currentVarName = useMemo(() => {
    if (filterValue.valueType !== 'variable') return '';
    const match = filterValue.value.match(/\{params\.(\w+)\}/);
    return match?.[1] || '';
  }, [filterValue.valueType, filterValue.value]);

  if (!viewId) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Select a data source first to configure the row filter.
      </div>
    );
  }

  if (loadingFields) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Loading fields...
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 border rounded-md bg-muted/20">
      <Label className="text-xs font-medium">Row Filter</Label>

      {/* Field and Operator Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Field Selector */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Field</Label>
          <Select value={filterValue.field} onValueChange={handleFieldChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              {fields.map(field => (
                <SelectItem key={field.id} value={field.name} className="text-xs">
                  {field.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operator Selector */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Operator</Label>
          <Select value={filterValue.operator} onValueChange={handleOperatorChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {availableOperators.map(op => (
                <SelectItem key={op.value} value={op.value} className="text-xs">
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Value Type Toggle */}
      {operatorNeedsValue(filterValue.operator) && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Value Type</Label>
            <RadioGroup
              value={filterValue.valueType}
              onValueChange={(v) => handleValueTypeChange(v as 'variable' | 'static')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="variable" id="variable" className="h-3 w-3" />
                <Label htmlFor="variable" className="text-xs font-normal cursor-pointer">
                  Page Variable
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="static" id="static" className="h-3 w-3" />
                <Label htmlFor="static" className="text-xs font-normal cursor-pointer">
                  Static Value
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Value Input */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              {filterValue.valueType === 'variable' ? 'Variable Name' : 'Value'}
            </Label>

            {filterValue.valueType === 'variable' ? (
              /* Combobox for Page Variables */
              <Popover open={varComboOpen} onOpenChange={setVarComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={varComboOpen}
                    className="w-full justify-between h-8 text-xs font-normal"
                  >
                    {currentVarName ? `{params.${currentVarName}}` : 'Select or create variable...'}
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
                            {`{params.${pv.name}}`}
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
                value={filterValue.value}
                onChange={(e) => handleStaticValueChange(e.target.value)}
                placeholder={selectedField?.type === 'number' ? 'Enter number...' : 'Enter value...'}
                type={selectedField?.type === 'number' ? 'number' : 'text'}
                className="h-8 text-xs"
              />
            )}
          </div>
        </>
      )}

      {/* Help text */}
      <p className="text-[10px] text-muted-foreground">
        {filterValue.valueType === 'variable'
          ? 'Uses a page variable defined in page settings'
          : 'Enter a fixed value to always filter by'}
      </p>
    </div>
  );
}

export default SingleRowFilterField;
