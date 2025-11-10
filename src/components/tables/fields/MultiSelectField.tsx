'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { X, ChevronDown, Plus } from 'lucide-react';
import type { SelectOption } from '@/ddd/domain/tables/value-objects/table-field';
import type { FieldDTO } from '@/app/mappers/field-mapper';

// Default colors for new options
const DEFAULT_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
];

interface MultiSelectFieldProps {
  value: number[] | null | undefined;
  onChange?: (value: number[]) => void;
  options: SelectOption[];
  isEditMode?: boolean;
  compact?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  maxSelections?: number;
  field?: FieldDTO;
  onFieldUpdate?: (updates: Partial<FieldDTO>) => Promise<void>;
}

/**
 * MultiSelectField - Component for multi-select field type
 *
 * Display Mode (isEditMode=false):
 * - Shows selected options as colored badges
 * - No interaction
 *
 * Edit Mode (isEditMode=true):
 * - Shows selected badges with remove buttons
 * - Dropdown with checkboxes to add/remove options
 * - Supports max selections limit
 * - Colored indicators for each option
 *
 * Usage:
 * - Table cells: compact={true}
 * - Forms: compact={false}
 */
export function MultiSelectField({
  value,
  onChange,
  options = [],
  isEditMode = false,
  compact = false,
  disabled = false,
  readOnly = false,
  placeholder = 'Select options...',
  maxSelections,
  field,
  onFieldUpdate
}: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Ensure value is always an array
  const selectedIds = Array.isArray(value) ? value : [];
  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));

  // Check if max selections reached
  const isMaxReached = maxSelections !== undefined && selectedIds.length >= maxSelections;

  // Handler to create new option
  const handleCreateOption = async () => {
    if (!newOptionLabel.trim() || !field || !onFieldUpdate) return;

    setIsCreating(true);
    try {
      // Generate new option
      const newId = options.length > 0 ? Math.max(...options.map(o => o.id)) + 1 : 1;
      const colorIndex = options.length % DEFAULT_COLORS.length;
      const newOption: SelectOption = {
        id: newId,
        value: newOptionLabel.trim(),
        color: DEFAULT_COLORS[colorIndex]
      };

      // Update field metadata
      await onFieldUpdate({
        metadata: {
          ...field.metadata,
          options: [...options, newOption]
        }
      });

      // Select the new option (add to existing selections if not at max)
      if (onChange && !isMaxReached) {
        onChange([...selectedIds, newId]);
      }

      setNewOptionLabel('');
    } catch (error) {
      console.error('Failed to create option:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle option toggle
  const handleToggle = (optionId: number) => {
    if (!onChange) return;

    const isSelected = selectedIds.includes(optionId);

    if (isSelected) {
      // Remove option
      onChange(selectedIds.filter(id => id !== optionId));
    } else {
      // Add option (if not at max)
      if (!isMaxReached) {
        onChange([...selectedIds, optionId]);
      }
    }
  };

  // Handle remove from badge
  const handleRemove = (optionId: number) => {
    if (!onChange) return;
    onChange(selectedIds.filter(id => id !== optionId));
  };

  // Handle clear all
  const handleClearAll = () => {
    if (!onChange) return;
    onChange([]);
  };

  // Display mode - show badges only
  if (!isEditMode || readOnly) {
    if (selectedOptions.length === 0) {
      return (
        <span className="text-xs text-muted-foreground">
          {compact ? '—' : 'No selections'}
        </span>
      );
    }

    return (
      <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {selectedOptions.slice(0, compact ? 2 : 5).map((option) => (
          <Badge
            key={option.id}
            style={{
              backgroundColor: option.color,
              color: '#fff',
              borderColor: option.color
            }}
            className={`font-normal ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs'}`}
          >
            {option.value}
          </Badge>
        ))}
        {selectedOptions.length > (compact ? 2 : 5) && (
          <Badge variant="secondary" className={compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs'}>
            +{selectedOptions.length - (compact ? 2 : 5)}
          </Badge>
        )}
      </div>
    );
  }

  // Edit mode - show interactive badges and dropdown
  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Selected badges with remove buttons - HIDE in compact mode for table cells */}
      {selectedOptions.length > 0 && !compact && (
        <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
          {selectedOptions.map((option) => (
            <div key={option.id} className="group relative">
              <Badge
                style={{
                  backgroundColor: option.color,
                  color: '#fff',
                  borderColor: option.color
                }}
                className={`font-normal pr-6 ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs'}`}
              >
                {option.value}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(option.id)}
                disabled={disabled}
                className={`
                  absolute -right-1 -top-1
                  ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                  p-0
                  opacity-0 group-hover:opacity-100
                  transition-opacity
                  bg-background border rounded-full shadow-sm
                  hover:bg-destructive hover:text-destructive-foreground
                `}
                title="Remove"
              >
                <X className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className={`justify-between ${compact ? 'h-7 text-xs' : ''} w-full`}
            disabled={disabled}
          >
            {compact && selectedOptions.length > 0 ? (
              // Compact mode: show badges inline with truncation
              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                {selectedOptions.slice(0, 1).map((option) => (
                  <Badge
                    key={option.id}
                    style={{
                      backgroundColor: option.color,
                      color: '#fff',
                      borderColor: option.color
                    }}
                    className="font-normal text-[10px] px-1.5 py-0 max-w-[80px] truncate"
                    title={option.value}
                  >
                    {option.value}
                  </Badge>
                ))}
                {selectedOptions.length > 1 && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    +{selectedOptions.length - 1}
                  </span>
                )}
              </div>
            ) : (
              // Regular mode: show text count
              <span className="text-muted-foreground">
                {selectedOptions.length === 0
                  ? placeholder
                  : `${selectedOptions.length} selected${maxSelections ? ` (max ${maxSelections})` : ''}`}
              </span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-2" align="start">
          <div className="space-y-1">
            {/* Clear all button */}
            {selectedOptions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all ({selectedOptions.length})
              </Button>
            )}

            {/* Max selections warning */}
            {isMaxReached && (
              <div className="text-xs text-amber-600 px-2 py-1 bg-amber-50 dark:bg-amber-950/20 rounded">
                Maximum {maxSelections} selections reached
              </div>
            )}

            {/* Options list */}
            {options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              const isDisabled = !isSelected && isMaxReached;

              return (
                <div
                  key={option.id}
                  className={`
                    flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
                    hover:bg-accent
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => !isDisabled && handleToggle(option.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(option.id)}
                    disabled={isDisabled}
                    className="pointer-events-none"
                  />
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="text-sm flex-1">{option.value}</span>
                </div>
              );
            })}

            {options.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-4">
                No options configured
              </div>
            )}

            {/* Create new option (only if onFieldUpdate is provided) */}
            {onFieldUpdate && field && (
              <div className="border-t pt-2 mt-1">
                <div className="flex gap-2">
                  <Input
                    placeholder="Create new option..."
                    value={newOptionLabel}
                    onChange={(e) => setNewOptionLabel(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && newOptionLabel.trim()) {
                        handleCreateOption();
                      }
                    }}
                    className="h-8 text-xs"
                    disabled={isCreating}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateOption}
                    disabled={!newOptionLabel.trim() || isCreating}
                    className="h-8 px-2"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
