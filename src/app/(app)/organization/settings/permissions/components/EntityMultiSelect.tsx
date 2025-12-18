'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X, Users, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type EntityType = 'user' | 'agent' | 'team' | 'role';

export interface EntityOption {
  id: string | number;
  name: string;
  type: EntityType;
  status?: string;
  description?: string;
}

interface EntityMultiSelectProps {
  entityType: EntityType;
  selectedIds: (string | number)[];
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  batchMode?: boolean;
  onBatchApply?: (selectedIds: (string | number)[]) => void;
  placeholder?: string;
  disabled?: boolean;
  fetchOptions: () => Promise<EntityOption[]>;
  className?: string;
}

const entityConfig = {
  user: { icon: User, label: 'Users', color: 'bg-blue-100 text-blue-800' },
  agent: { icon: Bot, label: 'Agents', color: 'bg-green-100 text-green-800' },
  team: { icon: Users, label: 'Teams', color: 'bg-purple-100 text-purple-800' },
  role: { icon: User, label: 'Roles', color: 'bg-orange-100 text-orange-800' }
};

export function EntityMultiSelect({
  entityType,
  selectedIds,
  onSelectionChange,
  batchMode = false,
  onBatchApply,
  placeholder = `Select ${entityType}s...`,
  disabled = false,
  fetchOptions,
  className
}: EntityMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [pendingSelections, setPendingSelections] = useState<(string | number)[]>(selectedIds);
  const [hasChanges, setHasChanges] = useState(false);

  const config = entityConfig[entityType];
  const Icon = config.icon;

  useEffect(() => {
    const loadOptions = async () => {
      setLoading(true);
      try {
        const fetchedOptions = await fetchOptions();
        setOptions(fetchedOptions);
      } catch (error) {
        console.error(`Error loading ${entityType} options:`, error);
      } finally {
        setLoading(false);
      }
    };

    if (open && options.length === 0) {
      loadOptions();
    }
  }, [open, entityType, fetchOptions, options.length]);

  const displaySelectedIds = batchMode ? pendingSelections : selectedIds;
  const selectedOptions = options.filter(option =>
    displaySelectedIds.includes(option.id)
  );

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const toggleSelection = (optionId: string | number) => {
    const currentSelection = batchMode ? pendingSelections : selectedIds;
    const newSelection = currentSelection.includes(optionId)
      ? currentSelection.filter(id => id !== optionId)
      : [...currentSelection, optionId];

    if (batchMode) {
      setPendingSelections(newSelection);
      setHasChanges(true);
      onBatchApply?.(newSelection);
    } else {
      onSelectionChange?.(newSelection);
    }
  };

  const removeSelection = (optionId: string | number) => {
    const currentSelection = batchMode ? pendingSelections : selectedIds;
    const newSelection = currentSelection.filter(id => id !== optionId);

    if (batchMode) {
      setPendingSelections(newSelection);
      setHasChanges(true);
      onBatchApply?.(newSelection);
    } else {
      onSelectionChange?.(newSelection);
    }
  };

  const clearAll = () => {
    if (batchMode) {
      setPendingSelections([]);
      setHasChanges(true);
      onBatchApply?.([]);
    } else {
      onSelectionChange?.([]);
    }
  };

  // Handle apply in batch mode
  const handleApply = () => {
    onSelectionChange?.(pendingSelections);
    setHasChanges(false);
  };

  // Handle cancel in batch mode
  const handleCancel = () => {
    setPendingSelections(selectedIds);
    setHasChanges(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected entities display */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((option) => (
            <Badge
              key={option.id}
              variant="secondary"
              className={cn("text-xs", config.color)}
            >
              <Icon className="w-3 h-3 mr-1" />
              {option.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeSelection(option.id)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
          {!disabled && selectedOptions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Multi-select dropdown */}
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn("w-full justify-between", selectedOptions.length > 0 && "h-auto min-h-[2.5rem]")}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="text-muted-foreground">
                  {selectedOptions.length > 0 
                    ? `${selectedOptions.length} ${config.label.toLowerCase()} selected`
                    : placeholder
                  }
                </span>
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0">
            <Command>
              <CommandInput
                placeholder={`Search ${config.label.toLowerCase()}...`}
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandEmpty>
                {loading ? `Loading ${config.label.toLowerCase()}...` : `No ${config.label.toLowerCase()} found.`}
              </CommandEmpty>
              <CommandGroup className="max-h-[200px] overflow-y-auto">
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    onSelect={() => toggleSelection(option.id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedIds.includes(option.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Icon className="w-4 h-4" />
                      <div className="flex-1">
                        <div className="font-medium">{option.name}</div>
                        {option.description && (
                          <div className="text-sm text-muted-foreground">{option.description}</div>
                        )}
                      </div>
                      {option.status && (
                        <Badge variant="outline" className="text-xs">
                          {option.status}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Batch mode apply/cancel buttons */}
      {batchMode && hasChanges && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            className="bg-green-600 hover:bg-green-700"
          >
            Apply Changes
          </Button>
        </div>
      )}
    </div>
  );
}