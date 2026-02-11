'use client';

/**
 * DocumentFieldSelector - Field selector for document fields
 *
 * Custom Puck field that loads fields from a view and filters to document type only.
 * Used by EditorBlock to select which document field to edit.
 */

import React, { useState, useEffect } from 'react';
import { FieldLabel } from '@measured/puck';
import { getFields } from '@/app/actions/fields';
import { getView } from '@/app/actions/views';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, AlertCircle, Loader2 } from 'lucide-react';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface DocumentFieldSelectorProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  viewId?: number;
  readOnly?: boolean;
}

export function DocumentFieldSelector({
  value,
  onChange,
  viewId,
  readOnly = false,
}: DocumentFieldSelectorProps) {
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load fields when viewId changes
  useEffect(() => {
    async function loadFields() {
      if (!viewId) {
        setFields([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Get view to find tableId
        const view = await getView(viewId);
        if (!view?.tableId) {
          setError('Could not load view');
          setFields([]);
          return;
        }

        // Load all fields for the table
        const allFields = await getFields(view.tableId);

        // Filter to document fields only
        const documentFields = allFields.filter(f => f.type === 'document');
        setFields(documentFields);

        // Auto-select if only one document field and nothing selected
        if (documentFields.length === 1 && !value) {
          onChange(documentFields[0].id);
        }
      } catch (err) {
        console.error('Failed to load fields:', err);
        setError('Failed to load fields');
        setFields([]);
      } finally {
        setLoading(false);
      }
    }

    loadFields();
  }, [viewId]);

  // No view selected
  if (!viewId) {
    return (
      <FieldLabel label="Document Field">
        <div className="text-xs text-muted-foreground py-2">
          Select a data source first to see available document fields.
        </div>
      </FieldLabel>
    );
  }

  // Loading state
  if (loading) {
    return (
      <FieldLabel label="Document Field">
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading fields...
        </div>
      </FieldLabel>
    );
  }

  // Error state
  if (error) {
    return (
      <FieldLabel label="Document Field">
        <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </div>
      </FieldLabel>
    );
  }

  // No document fields available
  if (fields.length === 0) {
    return (
      <FieldLabel label="Document Field">
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-xs">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          No document fields found in this view&apos;s table.
        </div>
      </FieldLabel>
    );
  }

  // Get selected field
  const selectedField = fields.find(f => f.id === value);

  return (
    <FieldLabel label="Document Field">
      <Select
        value={value?.toString()}
        onValueChange={(val) => {
          const parsed = parseInt(val);
          if (!isNaN(parsed)) {
            onChange(parsed);
          }
        }}
        disabled={readOnly}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select document field...">
            {selectedField && (
              <span className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span>{selectedField.name}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.id.toString()}>
              <span className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span>{field.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldLabel>
  );
}

export default DocumentFieldSelector;
