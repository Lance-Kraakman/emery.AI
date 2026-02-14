'use client';

/**
 * FieldRenderer - Renders fields with appropriate components based on field type
 *
 * Unified field rendering component used in:
 * - Human task cards (HumanTaskCard.tsx) for displaying inputs and collecting outputs
 * - Tasks page dialog (TasksClient.tsx) for the same purpose
 *
 * Type Safety Approach:
 * - Uses `unknown` for values from external sources (API, user input)
 * - Each field type case performs explicit type narrowing/coercion
 * - Type guards used for complex types (EmailThreadFieldValue)
 * - String coercion via helper for display safety
 *
 * AIDEV-NOTE: Part of Phase 2 - Typed Human Skill Fields
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { EmailThreadField } from '@/components/tables/fields/EmailThreadField';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { isEmailThreadFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { Calendar, FileText, Hash, Link2, Mail, Phone } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/** Render mode for field components */
export type FieldRenderMode = 'view' | 'edit';

export interface FieldRendererProps {
  /** Field type for determining which component to render. Falls back to 'text' if not provided. */
  fieldType?: FieldType | string;
  /** The current value - uses unknown since values come from dynamic sources */
  value: unknown;
  /** Callback for value changes (edit mode only) */
  onChange?: (value: unknown) => void;
  /** Display mode: 'view' for read-only display, 'edit' for input fields */
  mode: FieldRenderMode;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Placeholder text for inputs */
  placeholder?: string;
  /** Field name for display */
  name?: string;
  /** Field description */
  description?: string;
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Safely convert unknown value to string for display
 */
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Safely convert unknown value to input string (for controlled inputs)
 */
function toInputString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/**
 * Check if value has a 'name' property (for file-like objects)
 */
function hasNameProperty(value: unknown): value is { name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof (value as Record<string, unknown>).name === 'string'
  );
}

/**
 * Format date values for display
 */
function formatDateValue(value: unknown): string {
  if (!value) return '—';
  try {
    const date = value instanceof Date ? value : new Date(String(value));
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(value);
  }
}

/**
 * Safely convert to array for multi-select display
 */
function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * FieldRenderer - Renders fields based on their type
 */
export function FieldRenderer({
  fieldType,
  value,
  onChange,
  mode,
  disabled = false,
  placeholder,
  name,
  description,
}: FieldRendererProps) {
  // Default to text type if not specified
  const type = fieldType || 'text';

  // Handle view mode
  if (mode === 'view') {
    return <ViewModeRenderer fieldType={type} value={value} />;
  }

  // Handle edit mode
  return (
    <EditModeRenderer
      fieldType={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      name={name}
    />
  );
}

// ============================================================================
// View Mode Renderer
// ============================================================================

interface ViewModeRendererProps {
  fieldType: FieldType | string;
  value: unknown;
}

/**
 * View mode renderer - displays values as read-only
 */
function ViewModeRenderer({ fieldType, value }: ViewModeRendererProps) {
  // Handle empty values
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  switch (fieldType) {
    case 'email-thread':
      if (!isEmailThreadFieldValue(value)) {
        return <span className="text-muted-foreground text-sm">Invalid email thread</span>;
      }
      return (
        <EmailThreadField
          value={value}
          isEditMode={false}
          compact={false}
          readOnly
        />
      );

    case 'boolean':
      return (
        <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
          {value ? 'Yes' : 'No'}
        </Badge>
      );

    case 'date':
    case 'created-at':
    case 'last-updated':
      return (
        <span className="text-sm flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {formatDateValue(value)}
        </span>
      );

    case 'number':
    case 'autonumber':
      return (
        <span className="text-sm flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          {toDisplayString(value)}
        </span>
      );

    case 'email': {
      const emailStr = toDisplayString(value);
      return (
        <span className="text-sm flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <a href={`mailto:${emailStr}`} className="text-blue-600 hover:underline">
            {emailStr}
          </a>
        </span>
      );
    }

    case 'phone': {
      const phoneStr = toDisplayString(value);
      return (
        <span className="text-sm flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <a href={`tel:${phoneStr}`} className="text-blue-600 hover:underline">
            {phoneStr}
          </a>
        </span>
      );
    }

    case 'relation':
      return (
        <span className="text-sm flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          {toDisplayString(value)}
        </span>
      );

    case 'file':
    case 'document':
      if (hasNameProperty(value)) {
        return (
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {value.name}
          </Badge>
        );
      }
      return (
        <span className="text-sm flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          {toDisplayString(value)}
        </span>
      );

    case 'single-select':
      return (
        <Badge variant="outline" className="text-xs">
          {toDisplayString(value)}
        </Badge>
      );

    case 'multi-select': {
      const items = toArray(value);
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((item, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {toDisplayString(item)}
            </Badge>
          ))}
        </div>
      );
    }

    case 'json':
      return (
        <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">
          {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
        </pre>
      );

    case 'text':
    default: {
      const textValue = toDisplayString(value);
      if (textValue.length > 100 || textValue.includes('\n')) {
        return (
          <p className="text-sm whitespace-pre-wrap break-words">{textValue}</p>
        );
      }
      return <span className="text-sm">{textValue}</span>;
    }
  }
}

// ============================================================================
// Edit Mode Renderer
// ============================================================================

interface EditModeRendererProps {
  fieldType: FieldType | string;
  value: unknown;
  onChange?: (value: unknown) => void;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
}

/**
 * Edit mode renderer - displays input fields for editing
 */
function EditModeRenderer({
  fieldType,
  value,
  onChange,
  disabled = false,
  placeholder,
  name,
}: EditModeRendererProps) {
  const handleChange = (newValue: unknown) => {
    onChange?.(newValue);
  };

  switch (fieldType) {
    case 'email-thread':
      // Email threads are read-only (composed through external email clients)
      if (!isEmailThreadFieldValue(value)) {
        return <span className="text-muted-foreground text-sm">No email thread</span>;
      }
      return (
        <EmailThreadField
          value={value}
          isEditMode={false}
          compact={false}
          readOnly
        />
      );

    case 'boolean':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`field-${name}`}
            checked={Boolean(value)}
            onCheckedChange={(checked) => handleChange(checked === true)}
            disabled={disabled}
          />
          <label
            htmlFor={`field-${name}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {name || 'Yes'}
          </label>
        </div>
      );

    case 'date':
      return (
        <Input
          type="date"
          value={toInputString(value)}
          onChange={(e) => handleChange(e.target.value || null)}
          disabled={disabled}
          className="bg-white dark:bg-gray-900"
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={toInputString(value)}
          onChange={(e) => {
            const numValue = e.target.value ? Number(e.target.value) : null;
            handleChange(numValue);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="bg-white dark:bg-gray-900"
        />
      );

    case 'email':
      return (
        <Input
          type="email"
          value={toInputString(value)}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder || 'email@example.com'}
          disabled={disabled}
          className="bg-white dark:bg-gray-900"
        />
      );

    case 'phone':
      return (
        <Input
          type="tel"
          value={toInputString(value)}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder || '+1 (555) 000-0000'}
          disabled={disabled}
          className="bg-white dark:bg-gray-900"
        />
      );

    case 'json': {
      const jsonStr = typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2);
      return (
        <Textarea
          value={jsonStr}
          onChange={(e) => {
            try {
              handleChange(JSON.parse(e.target.value));
            } catch {
              // Keep as string if invalid JSON
              handleChange(e.target.value);
            }
          }}
          placeholder={placeholder || 'Enter JSON...'}
          disabled={disabled}
          rows={4}
          className="bg-white dark:bg-gray-900 font-mono text-xs"
        />
      );
    }

    case 'text':
    default: {
      const stringValue = toInputString(value);
      const isLongText = stringValue.length > 100 || stringValue.includes('\n');

      if (isLongText) {
        return (
          <Textarea
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            className="bg-white dark:bg-gray-900"
          />
        );
      }

      return (
        <Input
          type="text"
          value={stringValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="bg-white dark:bg-gray-900"
        />
      );
    }
  }
}

export default FieldRenderer;
