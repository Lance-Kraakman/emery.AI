'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
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

interface SingleSelectFieldProps {
  value: number | null | undefined;
  onChange?: (value: number | null) => void;
  options: SelectOption[];
  isEditMode?: boolean;
  compact?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  field?: FieldDTO;
  onFieldUpdate?: (updates: Partial<FieldDTO>) => Promise<void>;
}

/**
 * SingleSelectField - Component for single-select field type
 *
 * Display Mode (isEditMode=false):
 * - Shows selected option as a colored badge
 * - No interaction
 *
 * Edit Mode (isEditMode=true):
 * - Shows dropdown selector with all available options
 * - Each option displays with its configured color
 * - Supports clearing selection
 *
 * Usage:
 * - Table cells: compact={true}
 * - Forms: compact={false}
 */
export function SingleSelectField({
  value,
  onChange,
  options = [],
  isEditMode = false,
  compact = false,
  disabled = false,
  readOnly = false,
  placeholder = 'Select option...',
  field,
  onFieldUpdate
}: SingleSelectFieldProps) {
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Normalize options: assign id/color if missing (agent-created fields may omit them)
  const safeOptions = options.map((opt, i) => ({
    ...opt,
    id: typeof opt.id === 'number' ? opt.id : i + 1,
    color: opt.color ?? '#3B82F6',
  }));

  // Find the selected option
  const selectedOption = safeOptions.find(opt => opt.id === value);

  // Handler to create and select new option
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

      console.log('[SingleSelectField] Creating new option', {
        fieldName: field.name,
        newOption,
        currentOptions: options.length,
        totalAfter: options.length + 1
      });

      // Update field metadata
      await onFieldUpdate({
        metadata: {
          ...field.metadata,
          options: [...options, newOption]
        }
      });

      console.log('[SingleSelectField] Option created successfully', {
        fieldName: field.name,
        optionValue: newOption.value
      });

      // Select the new option
      if (onChange) {
        onChange(newId);
      }

      setNewOptionLabel('');
    } catch (error) {
      console.error('[SingleSelectField] Failed to create option', {
        fieldName: field?.name,
        error
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Display mode - show badge
  if (!isEditMode || readOnly) {
    if (!selectedOption) {
      return (
        <span className="text-xs text-muted-foreground">
          {compact ? '—' : 'No selection'}
        </span>
      );
    }

    return (
      <Badge
        style={{
          backgroundColor: selectedOption.color,
          color: '#fff',
          borderColor: selectedOption.color
        }}
        className="font-normal"
      >
        {selectedOption.value}
      </Badge>
    );
  }

  // Edit mode - show dropdown
  return (
    <Select
      value={value?.toString() || '__CLEAR__'}
      onValueChange={(val) => {
        if (onChange) {
          onChange(val === '__CLEAR__' ? null : parseInt(val));
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger className={compact ? 'h-8 text-xs' : ''}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {/* Option to clear selection */}
        <SelectItem value="__CLEAR__">
          <span className="text-muted-foreground text-xs">None</span>
        </SelectItem>

        {/* All available options */}
        {safeOptions.map((option) => (
          <SelectItem key={option.id} value={option.id.toString()}>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: option.color }}
              />
              <span>{option.value}</span>
            </div>
          </SelectItem>
        ))}

        {/* Create new option (only if onFieldUpdate is provided) */}
        {onFieldUpdate && field && (
          <div className="border-t p-2 mt-1" onClick={(e) => e.stopPropagation()}>
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
      </SelectContent>
    </Select>
  );
}
