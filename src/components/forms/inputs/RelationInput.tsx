'use client';

/**
 * RelationInput Component
 *
 * Form input for relation field types
 * Allows searching and selecting related records
 *
 * AIDEV-NOTE: Basic implementation - can be enhanced with async search
 */

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { InputThemeClasses } from '../input-mapper';

interface RelationInputProps {
  field: FieldDTO;
  value: number | null; // Related record ID
  onChange: (value: number | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  themeClasses?: InputThemeClasses;
}

export function RelationInput({
  field,
  value,
  onChange,
  label,
  required,
  disabled,
  themeClasses,
}: RelationInputProps) {
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  // Extract relation config from metadata
  const targetTableId = field.relatedTableId;
  const displayField = (field.metadata as any)?.displayField as string | undefined;

  const [records, setRecords] = useState<Array<{ id: number; display: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // TODO: Implement actual record fetching from related table
  // For now, this is a placeholder
  useEffect(() => {
    if (!targetTableId) return;

    // Placeholder for fetching related records
    // In real implementation, fetch records from the related table
    setRecords([
      { id: 1, display: 'Record 1' },
      { id: 2, display: 'Record 2' },
      { id: 3, display: 'Record 3' },
    ]);
  }, [targetTableId]);

  const filteredRecords = records.filter((record) =>
    record.display.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!targetTableId) {
    return (
      <div className="space-y-2">
        <Label>{inputLabel}</Label>
        <p className="text-sm text-muted-foreground">
          No related table configured
        </p>
      </div>
    );
  }

  return (
    <div className={themeClasses?.fieldGroup || "space-y-2"}>
      <Label htmlFor={`field-${field.id}`} className={themeClasses?.label || undefined}>
        {inputLabel}
        {isRequired && <span className={themeClasses?.error || "text-destructive ml-1"}>*</span>}
      </Label>

      <div className="space-y-2">
        <Input
          type="search"
          placeholder="Search records..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled}
          className={themeClasses?.input || undefined}
        />

        <Select
          value={value?.toString() || ''}
          onValueChange={(val) => onChange(val ? parseInt(val) : null)}
          disabled={disabled || loading}
        >
          <SelectTrigger id={`field-${field.id}`} className={themeClasses?.select || undefined}>
            <SelectValue placeholder={`Select ${inputLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {filteredRecords.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No records found
              </div>
            ) : (
              filteredRecords.map((record) => (
                <SelectItem key={record.id} value={record.id.toString()}>
                  {record.display}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Linked to table #{targetTableId}
        {displayField && ` (showing ${displayField})`}
      </p>
    </div>
  );
}
