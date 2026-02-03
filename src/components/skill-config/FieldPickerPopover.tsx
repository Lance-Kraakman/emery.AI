'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getFields } from '@/app/actions/fields';
import { fieldTypeToInputType } from './field-type-maps';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';

interface FieldPickerPopoverProps {
  tableId: number;
  buttonLabel: string;
  buttonIcon?: React.ReactNode;
  onSelectFields: (fields: FieldDTO[]) => void;
}

export function FieldPickerPopover({
  tableId,
  buttonLabel,
  buttonIcon,
  onSelectFields,
}: FieldPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && fields.length === 0 && !loading) {
      setLoading(true);
      getFields(tableId)
        .then((fetched) => {
          if (Array.isArray(fetched)) {
            const readable = fetched.filter(
              (f) => f.name !== 'id' && fieldTypeToInputType[f.type as FieldType] !== null
            );
            setFields(readable);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, fields.length, loading, tableId]);

  const handleToggle = (id: number) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedFieldIds.size === fields.length) {
      setSelectedFieldIds(new Set());
    } else {
      setSelectedFieldIds(new Set(fields.map((f) => f.id)));
    }
  };

  const handleAdd = () => {
    const selected = fields.filter((f) => selectedFieldIds.has(f.id));
    onSelectFields(selected);
    setOpen(false);
    setSelectedFieldIds(new Set());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground hover:text-foreground">
          {buttonIcon}
          {buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Select Fields</Label>
            {fields.length > 0 && (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={handleSelectAll}
              >
                {selectedFieldIds.size === fields.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground py-2">Loading...</div>
          ) : fields.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">No fields available</div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-0.5 border rounded-md p-1.5">
              {fields.map((field) => (
                <label
                  key={field.id}
                  className="flex items-center gap-2 py-1 px-1.5 hover:bg-muted/50 rounded cursor-pointer"
                >
                  <Checkbox
                    checked={selectedFieldIds.has(field.id)}
                    onCheckedChange={() => handleToggle(field.id)}
                  />
                  <span className="text-[11px] flex-1 truncate">{field.name}</span>
                  <span className="text-[9px] text-muted-foreground">{field.type}</span>
                </label>
              ))}
            </div>
          )}
          {selectedFieldIds.size > 0 && (
            <Button type="button" size="sm" className="w-full h-7 text-xs" onClick={handleAdd}>
              Add {selectedFieldIds.size} field{selectedFieldIds.size !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
