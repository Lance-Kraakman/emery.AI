'use client';

/**
 * VariableAutocompleteInput
 *
 * A text input with inline autocomplete for template variables.
 * Shows suggestions when user types `{` and allows inserting variables.
 *
 * Supports:
 * - {fieldName} - Row data fields from DataBlock context
 * - {params.name} - Page variables (defined at page level) and URL query parameters
 *
 * Uses DataLayoutContext to get available fields and sample values.
 * Uses PageVariablesContext to get defined page variables.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import { usePageVariables } from '../contexts/PageVariablesContext';
import { Database, Link2, Variable, ChevronRight } from 'lucide-react';

interface VariableOption {
  variable: string;
  label: string;
  sampleValue?: string;
  description?: string;
  group: 'fields' | 'pageVars' | 'params';
}

interface VariableAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}

export function VariableAutocompleteInput({
  value,
  onChange,
  placeholder,
  className,
  multiline = false,
  rows = 3,
  disabled = false,
}: VariableAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Track the position where { was typed to know where to insert
  const [variableStartPos, setVariableStartPos] = useState(-1);
  // Track current cursor position for insertion
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Get data context for fields and sample values
  const dataContext = useDataLayoutContext();
  const pageVariables = usePageVariables();
  const searchParams = useSearchParams();

  // Build list of available variables
  const options = useMemo<VariableOption[]>(() => {
    const result: VariableOption[] = [];

    // Add id field first (system field not in fields list but always available in rows)
    if (dataContext?.sampleRow?.id !== undefined) {
      result.push({
        variable: 'id',
        label: 'id',
        sampleValue: String(dataContext.sampleRow.id),
        group: 'fields',
      });
    }

    // Add field variables from DataLayoutContext
    if (dataContext?.fields) {
      for (const field of dataContext.fields) {
        const sampleValue = dataContext.sampleRow?.[field.name];
        result.push({
          variable: field.name,
          label: field.name,
          sampleValue: sampleValue !== undefined ? String(sampleValue) : undefined,
          group: 'fields',
        });
      }
    }

    // Add page variables (defined at page level)
    const addedPageVars = new Set<string>();
    for (const pageVar of pageVariables) {
      result.push({
        variable: `params.${pageVar.name}`,
        label: pageVar.name,
        description: pageVar.description,
        group: 'pageVars',
      });
      addedPageVars.add(pageVar.name);
    }

    // Add query param variables (only if not already added as page variable)
    searchParams.forEach((paramValue, paramName) => {
      if (!addedPageVars.has(paramName)) {
        result.push({
          variable: `params.${paramName}`,
          label: paramName,
          sampleValue: paramValue,
          group: 'params',
        });
      }
    });

    return result;
  }, [dataContext?.fields, dataContext?.sampleRow, pageVariables, searchParams]);

  // Filter options based on search text
  const filteredOptions = useMemo(() => {
    if (!searchText) return options;
    const lower = searchText.toLowerCase();
    return options.filter(
      (opt) =>
        opt.variable.toLowerCase().includes(lower) ||
        opt.label.toLowerCase().includes(lower)
    );
  }, [options, searchText]);

  // Group options for display
  const groupedOptions = useMemo(() => {
    const fields = filteredOptions.filter((o) => o.group === 'fields');
    const pageVars = filteredOptions.filter((o) => o.group === 'pageVars');
    const params = filteredOptions.filter((o) => o.group === 'params');
    return { fields, pageVars, params };
  }, [filteredOptions]);

  // Find the start of the current variable being typed
  const findVariableStart = useCallback((text: string, pos: number): number => {
    for (let i = pos - 1; i >= 0; i--) {
      if (text[i] === '{') {
        return i;
      }
      if (text[i] === '}' || text[i] === ' ' || text[i] === '\n') {
        return -1;
      }
    }
    return -1;
  }, []);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursor = e.target.selectionStart || 0;
      onChange(newValue);
      setCursorPosition(newCursor);

      // Check if we should open the autocomplete
      const varStart = findVariableStart(newValue, newCursor);
      if (varStart >= 0) {
        const textAfterBrace = newValue.substring(varStart + 1, newCursor);
        setSearchText(textAfterBrace);
        setVariableStartPos(varStart);
        setIsOpen(true);
        setSelectedIndex(0);
      } else {
        setIsOpen(false);
        setSearchText('');
        setVariableStartPos(-1);
      }
    },
    [onChange, findVariableStart]
  );

  // Handle key events for navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      const totalOptions = filteredOptions.length;
      if (totalOptions === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalOptions);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredOptions[selectedIndex]) {
            insertVariable(filteredOptions[selectedIndex].variable);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filteredOptions, selectedIndex]
  );

  // Insert a variable at the current position
  const insertVariable = useCallback(
    (variable: string) => {
      // Use the stored variableStartPos instead of recalculating
      // This ensures we use the position captured when the popover opened
      if (variableStartPos < 0) return;

      // Replace from { to cursor with {variable}
      const before = value.substring(0, variableStartPos);
      const after = value.substring(cursorPosition);
      const newValue = `${before}{${variable}}${after}`;
      onChange(newValue);

      // Move cursor after the inserted variable
      const newCursor = before.length + variable.length + 2; // +2 for {}
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursor, newCursor);
          inputRef.current.focus();
        }
      }, 0);

      setIsOpen(false);
      setSearchText('');
      setVariableStartPos(-1);
    },
    [value, cursorPosition, variableStartPos, onChange]
  );

  // Handle option click
  const handleOptionClick = useCallback(
    (option: VariableOption) => {
      insertVariable(option.variable);
    },
    [insertVariable]
  );

  // Reset selected index when filtered options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredOptions.length]);

  const hasNoContext = !dataContext?.fields?.length && pageVariables.length === 0 && searchParams.size === 0;
  const hasNoMatches = filteredOptions.length === 0 && !hasNoContext;

  // Common input props
  const inputProps = {
    ref: inputRef as any,
    value: value || '',
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder: placeholder || 'Type { for variables...',
    className: cn('font-mono text-sm', className),
    disabled,
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        {multiline ? (
          <Textarea {...inputProps} rows={rows} />
        ) : (
          <Input {...inputProps} />
        )}
      </PopoverAnchor>

      <PopoverContent
        className="w-[300px] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="max-h-[250px] overflow-y-auto">
          {hasNoContext && (
            <div className="py-6 px-4 text-center text-sm text-muted-foreground">
              <p>No data context available</p>
              <p className="text-xs mt-1">Place this inside a Data block to access row fields</p>
            </div>
          )}

          {hasNoMatches && (
            <div className="py-6 px-4 text-center text-sm text-muted-foreground">
              No variables match &quot;{searchText}&quot;
            </div>
          )}

          {/* Field Variables */}
          {groupedOptions.fields.length > 0 && (
            <div className="p-1">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                Row Fields
              </div>
              {groupedOptions.fields.map((option, idx) => {
                const globalIdx = idx;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <button
                    key={option.variable}
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer',
                      isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOptionClick(option);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <code className="text-xs bg-muted px-1 rounded">
                        {`{${option.variable}}`}
                      </code>
                    </div>
                    {option.sampleValue !== undefined && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {option.sampleValue}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Page Variables (includes both defined page vars and URL params) */}
          {(groupedOptions.pageVars.length > 0 || groupedOptions.params.length > 0) && (
            <div className={cn("p-1", groupedOptions.fields.length > 0 && "border-t")}>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Variable className="h-3 w-3" />
                Page Variables
              </div>
              {/* Defined page variables first */}
              {groupedOptions.pageVars.map((option, idx) => {
                const globalIdx = groupedOptions.fields.length + idx;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <button
                    key={option.variable}
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer',
                      isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOptionClick(option);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <code className="text-xs bg-muted px-1 rounded">
                        {`{${option.variable}}`}
                      </code>
                    </div>
                    {option.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {option.description}
                      </span>
                    )}
                  </button>
                );
              })}
              {/* Additional URL params not defined in page settings */}
              {groupedOptions.params.map((option, idx) => {
                const globalIdx = groupedOptions.fields.length + groupedOptions.pageVars.length + idx;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <button
                    key={option.variable}
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer',
                      isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOptionClick(option);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <code className="text-xs bg-muted px-1 rounded">
                        {`{${option.variable}}`}
                      </code>
                    </div>
                    {option.sampleValue !== undefined && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {option.sampleValue}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default VariableAutocompleteInput;
