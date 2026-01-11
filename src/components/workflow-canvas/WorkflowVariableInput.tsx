'use client';

/**
 * WorkflowVariableInput
 *
 * A text input with inline autocomplete for workflow variables.
 * Adapted from VariableAutocompleteInput for workflow canvas use.
 *
 * Shows suggestions when user types `{` and allows inserting variables
 * in {{variable}} format.
 *
 * Variable sources (passed as props):
 * - Skill inputs
 * - Previous step outputs
 * - Loop context variables (item, index)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronRight, Variable, Braces, IterationCw } from 'lucide-react';

export interface WorkflowVariable {
  name: string;
  label?: string;
  description?: string;
  group: 'input' | 'output' | 'loop' | 'special';
}

interface WorkflowVariableInputProps {
  value: string;
  onChange: (value: string) => void;
  variables: WorkflowVariable[];
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}

const groupIcons = {
  input: Variable,
  output: Braces,
  loop: IterationCw,
  special: Braces,
};

const groupLabels = {
  input: 'Skill Inputs',
  output: 'Step Outputs',
  loop: 'Loop Variables',
  special: 'Special Variables',
};

export function WorkflowVariableInput({
  value,
  onChange,
  variables,
  placeholder,
  className,
  multiline = false,
  rows = 3,
  disabled = false,
}: WorkflowVariableInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [variableStartPos, setVariableStartPos] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Filter variables based on search text
  const filteredVariables = useMemo(() => {
    if (!searchText) return variables;
    const lower = searchText.toLowerCase();
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(lower) ||
        v.label?.toLowerCase().includes(lower)
    );
  }, [variables, searchText]);

  // Group variables by type
  const groupedVariables = useMemo(() => {
    const groups: Record<string, WorkflowVariable[]> = {
      input: [],
      output: [],
      loop: [],
      special: [],
    };
    for (const v of filteredVariables) {
      groups[v.group].push(v);
    }
    return groups;
  }, [filteredVariables]);

  // Get flat list for keyboard navigation
  const flatList = useMemo(() => {
    return [
      ...groupedVariables.input,
      ...groupedVariables.output,
      ...groupedVariables.loop,
      ...groupedVariables.special,
    ];
  }, [groupedVariables]);

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

      const totalOptions = flatList.length;
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
          if (flatList[selectedIndex]) {
            insertVariable(flatList[selectedIndex].name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, flatList, selectedIndex]
  );

  // Insert a variable at the current position
  const insertVariable = useCallback(
    (variableName: string) => {
      if (variableStartPos < 0) return;

      const before = value.substring(0, variableStartPos);
      const after = value.substring(cursorPosition);
      const newValue = `${before}{{${variableName}}}${after}`;
      onChange(newValue);

      // Move cursor after the inserted variable
      const newCursor = before.length + variableName.length + 4;
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
    (variable: WorkflowVariable) => {
      insertVariable(variable.name);
    },
    [insertVariable]
  );

  // Reset selected index when filtered options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatList.length]);

  const hasNoVariables = variables.length === 0;
  const hasNoMatches = flatList.length === 0 && !hasNoVariables;

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

  // Calculate global index for a variable in a group
  const getGlobalIndex = (group: string, localIndex: number): number => {
    let offset = 0;
    const order = ['input', 'output', 'loop', 'special'];
    for (const g of order) {
      if (g === group) return offset + localIndex;
      offset += groupedVariables[g].length;
    }
    return localIndex;
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
        className="w-[280px] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="max-h-[250px] overflow-y-auto">
          {hasNoVariables && (
            <div className="py-6 px-4 text-center text-sm text-muted-foreground">
              <p>No variables available</p>
              <p className="text-xs mt-1">Add skill inputs to use variables</p>
            </div>
          )}

          {hasNoMatches && (
            <div className="py-6 px-4 text-center text-sm text-muted-foreground">
              No variables match &quot;{searchText}&quot;
            </div>
          )}

          {/* Render each group */}
          {(['input', 'output', 'loop', 'special'] as const).map((group, groupIdx) => {
            const groupVars = groupedVariables[group];
            if (groupVars.length === 0) return null;

            const Icon = groupIcons[group];
            const showBorder = groupIdx > 0 &&
              ['input', 'output', 'loop', 'special']
                .slice(0, groupIdx)
                .some(g => groupedVariables[g].length > 0);

            return (
              <div key={group} className={cn('p-1', showBorder && 'border-t')}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Icon className="h-3 w-3" />
                  {groupLabels[group]}
                </div>
                {groupVars.map((variable, localIdx) => {
                  const globalIdx = getGlobalIndex(group, localIdx);
                  const isSelected = selectedIndex === globalIdx;
                  return (
                    <button
                      key={variable.name}
                      type="button"
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer',
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOptionClick(variable);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <code className="text-xs bg-muted px-1 rounded">
                          {`{{${variable.name}}}`}
                        </code>
                      </div>
                      {(variable.description || variable.label) && (
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                          {variable.label || variable.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default WorkflowVariableInput;
