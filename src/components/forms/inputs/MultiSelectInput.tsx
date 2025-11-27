'use client';

/**
 * MultiSelectInput Component
 *
 * Form input for multi-select field types
 * Uses SelectOption[] from field metadata
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { SelectOption } from '@/ddd/domain/tables/value-objects/table-field';

interface MultiSelectInputProps {
  field: FieldDTO;
  value: number[]; // Array of SelectOption IDs
  onChange: (value: number[]) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function MultiSelectInput({
  field,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
}: MultiSelectInputProps) {
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  // Extract options from field metadata
  const options = (field.metadata as any)?.options as SelectOption[] | undefined;
  const maxSelections = (field.metadata as any)?.maxSelections as number | undefined;

  if (!options || options.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{inputLabel}</Label>
        <p className="text-sm text-muted-foreground">No options configured</p>
      </div>
    );
  }

  const selectedOptions = options.filter((opt) => value.includes(opt.id));

  const toggleOption = (optionId: number) => {
    if (value.includes(optionId)) {
      onChange(value.filter((id) => id !== optionId));
    } else {
      if (maxSelections && value.length >= maxSelections) {
        return; // Max selections reached
      }
      onChange([...value, optionId]);
    }
  };

  const removeOption = (optionId: number) => {
    onChange(value.filter((id) => id !== optionId));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.id}`}>
        {inputLabel}
        {isRequired && <span className="text-destructive ml-1">*</span>}
        {maxSelections && (
          <span className="text-xs text-muted-foreground ml-2">
            (Max {maxSelections})
          </span>
        )}
      </Label>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            disabled={disabled}
          >
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">
                {placeholder || `Select ${inputLabel.toLowerCase()}`}
              </span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedOptions.map((option) => (
                  <Badge
                    key={option.id}
                    variant="secondary"
                    className="gap-1"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                    {option.value}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOption(option.id);
                      }}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-2">
          <div className="space-y-2">
            {options.map((option) => {
              const isSelected = value.includes(option.id);
              const isDisabled =
                maxSelections &&
                !isSelected &&
                value.length >= maxSelections;

              return (
                <div
                  key={option.id}
                  className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                  onClick={() => !isDisabled && toggleOption(option.id)}
                >
                  <Checkbox checked={isSelected} disabled={isDisabled || false} />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="flex-1">{option.value}</span>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
