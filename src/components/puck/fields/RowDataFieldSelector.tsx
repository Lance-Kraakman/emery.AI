'use client';

/**
 * RowDataFieldSelector - Field name selector for ConditionalBlock
 *
 * Shows available fields from the parent DataBlock context.
 * Includes the built-in 'id' field and shows type information.
 *
 * Unlike FieldSelectorField which returns field IDs, this returns field names
 * for use in templates like {{rowData.fieldName}}.
 */

import React from 'react';
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
  Key,
} from 'lucide-react';

// Map field types to icons
const fieldTypeIcons: Record<FieldType | 'id', React.ReactNode> = {
  'id': <Key className="h-3.5 w-3.5" />,
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
const fieldTypeLabels: Record<FieldType | 'id', string> = {
  'id': 'Row ID',
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

interface FieldOption {
  name: string;
  type: FieldType | 'id';
}

interface RowDataFieldSelectorProps {
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Called when field type changes (for type-aware operators) */
  onFieldTypeChange?: (type: FieldType | 'id' | undefined) => void;
}

export function RowDataFieldSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select a field...',
  onFieldTypeChange,
}: RowDataFieldSelectorProps) {
  const dataContext = useDataLayoutContext();

  // Build field options - always include 'id', plus fields from context
  const fieldOptions: FieldOption[] = React.useMemo(() => {
    const options: FieldOption[] = [{ name: 'id', type: 'id' }];

    if (dataContext?.fields) {
      for (const field of dataContext.fields) {
        options.push({ name: field.name, type: field.type });
      }
    }

    return options;
  }, [dataContext?.fields]);

  // Get selected field info
  const selectedField = fieldOptions.find(f => f.name === value);

  // Notify parent of field type when value changes
  React.useEffect(() => {
    if (onFieldTypeChange) {
      onFieldTypeChange(selectedField?.type);
    }
  }, [selectedField?.type, onFieldTypeChange]);

  // Not inside a DataBlock - show only 'id' option
  if (!dataContext) {
    return (
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={placeholder}>
            {value === 'id' && (
              <span className="flex items-center gap-2">
                {fieldTypeIcons['id']}
                <span>id</span>
                <span className="text-muted-foreground text-xs">(Row ID)</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="id">
            <span className="flex items-center gap-2">
              {fieldTypeIcons['id']}
              <span>id</span>
              <span className="text-muted-foreground text-xs">(Row ID)</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // No fields available (except id)
  if (dataContext.fields.length === 0) {
    return (
      <div className="space-y-2">
        <Select
          value={value}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={placeholder}>
              {value === 'id' && (
                <span className="flex items-center gap-2">
                  {fieldTypeIcons['id']}
                  <span>id</span>
                  <span className="text-muted-foreground text-xs">(Row ID)</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">
              <span className="flex items-center gap-2">
                {fieldTypeIcons['id']}
                <span>id</span>
                <span className="text-muted-foreground text-xs">(Row ID)</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-xs">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Only row ID available. Place inside a Data block for more fields.</span>
        </div>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={placeholder}>
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
        {fieldOptions.map((f) => (
          <SelectItem key={f.name} value={f.name}>
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
  );
}

export default RowDataFieldSelector;
