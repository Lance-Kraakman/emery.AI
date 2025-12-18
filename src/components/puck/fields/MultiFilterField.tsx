'use client';

/**
 * MultiFilterField - Custom Puck field for DataBlock row filtering
 *
 * Provides a multi-condition filter configuration UI:
 * - AND/OR logic toggle
 * - Multiple filter conditions (add/remove)
 * - Field selector (from table fields)
 * - Operator selector (based on field type)
 * - Value type toggle (Page Variable, Parent Row, or Static)
 * - Value input (combobox for vars, dropdown for parent fields, text for static)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFields } from '@/app/actions/fields';
import { getView } from '@/app/actions/views';
import { usePageVariablesContext } from '../contexts/PageVariablesContext';
import { useParentRowData } from '../contexts/RowDataContext';
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
 * A single filter condition
 */
export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  valueType: 'variable' | 'parentRow' | 'static';
  value: string;
}

/**
 * The complete filter configuration with multiple conditions and logic
 */
export interface RowFilterConfig {
  conditions: FilterCondition[];
  logic: 'and' | 'or';
}

/** Default empty filter configuration */
const DEFAULT_FILTER_CONFIG: RowFilterConfig = {
  conditions: [],
  logic: 'and',
};

/** Create a new empty condition */
function createEmptyCondition(): FilterCondition {
  return {
    id: crypto.randomUUID(),
    field: '',
    operator: 'eq',
    valueType: 'variable',
    value: '',
  };
}

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

/** Regex to extract field name from {rowData.fieldName} format */
const ROW_DATA_VAR_REGEX = /\{rowData\.(\w+)\}/;

/** Parse field name from {rowData.fieldName} format */
function parseRowDataVariable(value: string): string {
  const match = value.match(ROW_DATA_VAR_REGEX);
  return match?.[1] || '';
}

/** Format field name to {rowData.fieldName} format */
function formatRowDataVariable(fieldName: string): string {
  return `{rowData.${fieldName}}`;
}

interface MultiFilterFieldProps {
  value?: RowFilterConfig;
  onChange: (value: RowFilterConfig) => void;
  /** viewId passed from resolveFields closure */
  viewId?: number;
  /** Parent fields for {rowData.x} variables (passed from ParentRowDataContext in future) */
  parentFields?: FieldDTO[];
}

export function MultiFilterField({
  value,
  onChange,
  viewId,
  parentFields: parentFieldsProp = [],
}: MultiFilterFieldProps) {
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const { pageVariables, addPageVariable } = usePageVariablesContext();

  // Get parent row data context for {rowData.x} variables
  const parentContext = useParentRowData();

  // Check if we have parent field metadata available (works even without row data)
  const hasParentFields = parentContext?.hasParentFields() || parentFieldsProp.length > 0;

  // Use parent fields from context if available, otherwise use prop
  const parentFields = parentContext?.getParentRowData()?.fields || parentFieldsProp;

  // Initialize with defaults
  const filterConfig: RowFilterConfig = value ?? DEFAULT_FILTER_CONFIG;

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

  // Handle logic toggle
  const handleLogicChange = useCallback((logic: 'and' | 'or') => {
    onChange({ ...filterConfig, logic });
  }, [filterConfig, onChange]);

  // Add a new condition
  const addCondition = useCallback(() => {
    const newCondition = createEmptyCondition();
    // Default to first field if available
    if (fields.length > 0) {
      newCondition.field = fields[0].name;
    }
    onChange({
      ...filterConfig,
      conditions: [...filterConfig.conditions, newCondition],
    });
  }, [filterConfig, fields, onChange]);

  // Remove a condition
  const removeCondition = useCallback((id: string) => {
    onChange({
      ...filterConfig,
      conditions: filterConfig.conditions.filter(c => c.id !== id),
    });
  }, [filterConfig, onChange]);

  // Update a condition
  const updateCondition = useCallback((id: string, updates: Partial<FilterCondition>) => {
    onChange({
      ...filterConfig,
      conditions: filterConfig.conditions.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
  }, [filterConfig, onChange]);

  if (!viewId) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Select a data source first to configure filters.
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
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Row Filter</Label>

        {/* Logic toggle - only show if multiple conditions */}
        {filterConfig.conditions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Match</span>
            <RadioGroup
              value={filterConfig.logic}
              onValueChange={(v) => handleLogicChange(v as 'and' | 'or')}
              className="flex gap-2"
            >
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="and" id="logic-and" className="h-3 w-3" />
                <Label htmlFor="logic-and" className="text-[10px] font-normal cursor-pointer">
                  All
                </Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="or" id="logic-or" className="h-3 w-3" />
                <Label htmlFor="logic-or" className="text-[10px] font-normal cursor-pointer">
                  Any
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      {/* Condition list */}
      <div className="space-y-2">
        {filterConfig.conditions.map((condition, index) => (
          <div key={condition.id} className="space-y-2">
            {/* Logic separator */}
            {index > 0 && (
              <div className="flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted rounded">
                  {filterConfig.logic.toUpperCase()}
                </span>
              </div>
            )}

            <FilterConditionRow
              condition={condition}
              fields={fields}
              parentFields={parentFields}
              hasParentFields={hasParentFields}
              pageVariables={pageVariables}
              addPageVariable={addPageVariable}
              onChange={(updates) => updateCondition(condition.id, updates)}
              onRemove={() => removeCondition(condition.id)}
            />
          </div>
        ))}
      </div>

      {/* Add condition button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={addCondition}
        className="w-full h-7 text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add condition
      </Button>

      {/* Help text */}
      {filterConfig.conditions.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          Add conditions to filter which rows are displayed
        </p>
      )}
    </div>
  );
}

interface FilterConditionRowProps {
  condition: FilterCondition;
  fields: FieldDTO[];
  parentFields: FieldDTO[];
  hasParentFields: boolean;
  pageVariables: PageVariable[];
  addPageVariable?: (variable: PageVariable) => Promise<void>;
  onChange: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
}

function FilterConditionRow({
  condition,
  fields,
  parentFields,
  hasParentFields,
  pageVariables,
  addPageVariable,
  onChange,
  onRemove,
}: FilterConditionRowProps) {
  const [varComboOpen, setVarComboOpen] = useState(false);
  const [newVarInput, setNewVarInput] = useState('');

  // Get selected field info
  const selectedField = useMemo(() => {
    return fields.find(f => f.name === condition.field);
  }, [fields, condition.field]);

  // Get available operators based on field type
  const availableOperators = useMemo(() => {
    const fieldType = (selectedField?.type as FieldType) || 'text';
    return OPERATORS_BY_FIELD_TYPE[fieldType] || TEXT_OPERATORS;
  }, [selectedField]);

  // Handle field change
  const handleFieldChange = (fieldName: string) => {
    onChange({ field: fieldName });
  };

  // Handle operator change
  const handleOperatorChange = (op: string) => {
    onChange({ operator: op as FilterOperator });
  };

  // Handle value type change
  const handleValueTypeChange = (type: 'variable' | 'parentRow' | 'static') => {
    onChange({ valueType: type, value: '' });
  };

  // Handle variable selection
  const handleSelectVariable = async (varName: string) => {
    const exists = pageVariables.some(v => v.name === varName);

    if (!exists && addPageVariable) {
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
      valueType: 'variable',
      value: formatParamVariable(varName),
    });
    setVarComboOpen(false);
    setNewVarInput('');
  };

  // Handle parent field selection
  const handleSelectParentField = (fieldName: string) => {
    onChange({
      valueType: 'parentRow',
      value: formatRowDataVariable(fieldName),
    });
  };

  // Handle static value change
  const handleStaticValueChange = (val: string) => {
    onChange({ value: val });
  };

  // Handle creating new variable from input
  const handleCreateNewVariable = () => {
    if (newVarInput.trim()) {
      const sanitized = newVarInput.trim().replace(/[^a-zA-Z0-9_]/g, '_');
      handleSelectVariable(sanitized);
    }
  };

  // Extract variable name from value
  const currentVarName = condition.valueType === 'variable'
    ? parseParamVariable(condition.value)
    : '';

  const currentParentField = condition.valueType === 'parentRow'
    ? parseRowDataVariable(condition.value)
    : '';

  return (
    <div className="p-2 border rounded bg-background space-y-2">
      {/* Field and Operator Row */}
      <div className="flex gap-2">
        {/* Field Selector */}
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Field</Label>
          <Select value={condition.field} onValueChange={handleFieldChange}>
            <SelectTrigger className="h-7 text-xs">
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
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Operator</Label>
          <Select value={condition.operator} onValueChange={handleOperatorChange}>
            <SelectTrigger className="h-7 text-xs">
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

        {/* Remove button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-7 w-7 mt-4 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Value section */}
      {operatorNeedsValue(condition.operator) && (
        <>
          {/* Value Type Toggle */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Value Type</Label>
            <RadioGroup
              value={condition.valueType}
              onValueChange={(v) => handleValueTypeChange(v as 'variable' | 'parentRow' | 'static')}
              className="flex gap-3"
            >
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="variable" id={`${condition.id}-variable`} className="h-3 w-3" />
                <Label htmlFor={`${condition.id}-variable`} className="text-[10px] font-normal cursor-pointer">
                  Page Variable
                </Label>
              </div>
              {hasParentFields && (
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="parentRow" id={`${condition.id}-parentRow`} className="h-3 w-3" />
                  <Label htmlFor={`${condition.id}-parentRow`} className="text-[10px] font-normal cursor-pointer">
                    Parent Row
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="static" id={`${condition.id}-static`} className="h-3 w-3" />
                <Label htmlFor={`${condition.id}-static`} className="text-[10px] font-normal cursor-pointer">
                  Static
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Value Input */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              {condition.valueType === 'variable' ? 'Variable' :
               condition.valueType === 'parentRow' ? 'Parent Field' : 'Value'}
            </Label>

            {condition.valueType === 'variable' ? (
              /* Combobox for Page Variables */
              <Popover open={varComboOpen} onOpenChange={setVarComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={varComboOpen}
                    className="w-full justify-between h-7 text-xs font-normal"
                  >
                    {currentVarName ? formatParamVariable(currentVarName) : 'Select or create...'}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or type new..."
                      className="h-7 text-xs"
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
                          </CommandItem>
                        ))}
                      </CommandGroup>
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
            ) : condition.valueType === 'parentRow' ? (
              /* Parent Field Selector */
              <Select value={currentParentField} onValueChange={handleSelectParentField}>
                <SelectTrigger className="h-7 text-xs">
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
                value={condition.value}
                onChange={(e) => handleStaticValueChange(e.target.value)}
                placeholder={selectedField?.type === 'number' ? 'Enter number...' : 'Enter value...'}
                type={selectedField?.type === 'number' ? 'number' : 'text'}
                className="h-7 text-xs"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MultiFilterField;
