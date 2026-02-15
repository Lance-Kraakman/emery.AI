'use client';

/**
 * DataFieldsPanel
 *
 * Sidebar panel that shows database fields from the selected DataBlock's view.
 * Clicking a field adds the appropriate field component (TextField, NumberField, etc.)
 * pre-configured with that field's ID.
 *
 * Only renders when a DataBlock is selected or when editing inside a DataBlock slot.
 */

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
  Database,
  Plus,
  Braces,
} from 'lucide-react';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { useDataBlockFieldsForPanel } from './hooks/useDataBlockFieldsForPanel';

/** Icons per field type - matches FieldSelectorField for consistency */
const FIELD_TYPE_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  relation: Link2,
  file: FileImage,
  document: FileText,
  embedding: Sparkles,
  'single-select': List,
  'multi-select': ListChecks,
  autonumber: Hash,
  'last-updated': Clock,
  'created-at': Clock,
  email: Mail,
  phone: Phone,
  json: Braces,
  'email-thread': Mail,
};

/** Human-readable type labels */
const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  date: 'Date',
  relation: 'Relation',
  file: 'File',
  document: 'Document',
  embedding: 'Embedding',
  'single-select': 'Select',
  'multi-select': 'Multi Select',
  autonumber: 'Autonumber',
  'last-updated': 'Last Updated',
  'created-at': 'Created At',
  email: 'Email',
  phone: 'Phone',
  json: 'JSON',
  'email-thread': 'Email Thread',
};

/** Field types that don't have a corresponding Puck field block */
const UNSUPPORTED_FIELD_TYPES = new Set<FieldType>(['embedding', 'json', 'email-thread']);

export function DataFieldsPanel() {
  const { isActive, fields, dataBlockId, insertField } = useDataBlockFieldsForPanel();

  if (!isActive) return null;

  // Filter out unsupported field types
  const displayFields = fields.filter((f) => !UNSUPPORTED_FIELD_TYPES.has(f.type));

  return (
    <div className="px-4 pt-3 pb-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Data Fields
        </span>
      </div>

      {displayFields.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 py-2">
          Select a view in the DataBlock to see available fields.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {displayFields.map((field) => {
            const Icon = FIELD_TYPE_ICONS[field.type] || Type;
            return (
              <button
                key={field.id}
                type="button"
                onClick={() => insertField(field)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-background hover:bg-accent hover:border-accent-foreground/20 text-left text-xs transition-colors group"
                title={`Add ${field.name} (${FIELD_TYPE_LABELS[field.type] || field.type})`}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{field.name}</span>
                <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
