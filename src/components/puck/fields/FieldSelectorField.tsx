'use client';

/**
 * FieldSelectorField - React Component
 *
 * Custom Puck field that shows available fields from the parent DataBlock.
 * Uses DataLayoutContext to get field metadata.
 *
 * Features:
 * - Shows field names instead of raw IDs
 * - Shows field type with icon
 * - Falls back to warning if not inside a DataBlock
 * - Optional type filtering
 */

import React from 'react';
import { FieldLabel } from '@measured/puck';
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Type,
  Hash,
  ToggleLeft,
  Calendar,
  Link2,
  FileImage,
  FileText,
  Sparkles,
  List,
  ListChecks,
  Clock,
  Mail,
  Phone,
  AlertCircle,
  Braces,
} from 'lucide-react';

// Map field types to icons
const fieldTypeIcons: Record<FieldType, React.ReactNode> = {
  'text': <Type className="h-3.5 w-3.5" />,
  'number': <Hash className="h-3.5 w-3.5" />,
  'boolean': <ToggleLeft className="h-3.5 w-3.5" />,
  'date': <Calendar className="h-3.5 w-3.5" />,
  'relation': <Link2 className="h-3.5 w-3.5" />,
  'file': <FileImage className="h-3.5 w-3.5" />,
  'document': <FileText className="h-3.5 w-3.5" />,
  'embedding': <Sparkles className="h-3.5 w-3.5" />,
  'single-select': <List className="h-3.5 w-3.5" />,
  'multi-select': <ListChecks className="h-3.5 w-3.5" />,
  'autonumber': <Hash className="h-3.5 w-3.5" />,
  'last-updated': <Clock className="h-3.5 w-3.5" />,
  'created-at': <Clock className="h-3.5 w-3.5" />,
  'email': <Mail className="h-3.5 w-3.5" />,
  'phone': <Phone className="h-3.5 w-3.5" />,
  'json': <Braces className="h-3.5 w-3.5" />,
  'email-thread': <Mail className="h-3.5 w-3.5" />,
};

// Human-readable type labels
const fieldTypeLabels: Record<FieldType, string> = {
  'text': 'Text',
  'number': 'Number',
  'boolean': 'Boolean',
  'date': 'Date',
  'relation': 'Relation',
  'file': 'File',
  'document': 'Document',
  'embedding': 'Embedding',
  'single-select': 'Single Select',
  'multi-select': 'Multi Select',
  'autonumber': 'Autonumber',
  'last-updated': 'Last Updated',
  'created-at': 'Created At',
  'email': 'Email',
  'phone': 'Phone',
  'json': 'JSON',
  'email-thread': 'Email Thread',
};

interface FieldSelectorFieldProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  readOnly?: boolean;
  field: {
    label?: string;
    filterTypes?: FieldType[];
  };
}

export function FieldSelectorFieldRenderer({
  value,
  onChange,
  readOnly,
  field,
}: FieldSelectorFieldProps) {
  const dataContext = useDataLayoutContext();

  // Not inside a DataBlock - show disabled dropdown (warning shows on canvas component)
  if (!dataContext) {
    return (
      <FieldLabel label={field.label || 'Field'}>
        <Select disabled>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select a field..." />
          </SelectTrigger>
        </Select>
      </FieldLabel>
    );
  }

  // No fields available
  if (dataContext.fields.length === 0) {
    return (
      <FieldLabel label={field.label || 'Field'}>
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-600 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>No fields available. Select a view in the Data block first.</span>
        </div>
      </FieldLabel>
    );
  }

  // Filter fields by type if specified
  const availableFields = field.filterTypes
    ? dataContext.fields.filter(f => field.filterTypes!.includes(f.type))
    : dataContext.fields;

  // Get selected field
  const selectedField = availableFields.find(f => f.id === value);

  return (
    <FieldLabel label={field.label || 'Field'}>
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
          <SelectValue placeholder="Select a field...">
            {selectedField && (
              <span className="flex items-center gap-2">
                {fieldTypeIcons[selectedField.type]}
                <span>{selectedField.name}</span>
                <span className="text-muted-foreground text-xs">
                  ({fieldTypeLabels[selectedField.type]})
                </span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availableFields.map((f) => (
            <SelectItem key={f.id} value={f.id.toString()}>
              <span className="flex items-center gap-2">
                {fieldTypeIcons[f.type]}
                <span>{f.name}</span>
                <span className="text-muted-foreground text-xs">
                  ({fieldTypeLabels[f.type]})
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldLabel>
  );
}
