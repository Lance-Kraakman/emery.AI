'use client';

/**
 * FormPage - Renders a single page in a multi-page form
 *
 * AIDEV-NOTE: This component renders all fields for a single form page.
 * Handles conditional field visibility based on other field values.
 * Uses the field input components for rendering different field types.
 */

import { useMemo } from 'react';
import {
  TextFieldInput,
  NumberFieldInput,
  BooleanFieldInput,
  DateFieldInput,
  SingleSelectFieldInput,
  MultiSelectFieldInput,
} from './field-inputs';
import { cn } from '@/lib/utils';
import type { SelectOption } from '@/ddd/domain/tables/value-objects/table-field';

// Types matching the domain layer FormViewConfig
export interface FormPageField {
  fieldId: number;
  order: number;
  label?: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  visible?: boolean;
  conditionalVisibility?: {
    dependsOn: number;
    operator: 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty' | 'contains';
    value?: any;
  };
  validationRules?: Array<{
    type: string;
    value?: any;
    message: string;
  }>;
}

// Re-export TableField type for use in other components
export interface TableField {
  id: number;
  name: string;
  type: string;
  required: boolean | null;
  orderIndex: number | null;
  relatedTableId: number | null;
  metadata?: Record<string, any>;
  createdAt?: Date | null;
}

export interface FormPageConfig {
  id: string;
  title?: string;
  description?: string;
  fields: FormPageField[];
  order: number;
}

export interface FormPageProps {
  page: FormPageConfig;
  tableFields: TableField[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  onChange: (fieldName: string, value: any) => void;
  className?: string;
}

export function FormPage({
  page,
  tableFields,
  formData,
  errors,
  onChange,
  className,
}: FormPageProps) {
  // Create a map of field IDs to table fields for quick lookup
  const tableFieldMap = useMemo(() => {
    return new Map(tableFields.map(f => [f.id, f]));
  }, [tableFields]);

  // Sort fields by order
  const sortedFields = useMemo(() => {
    return [...page.fields].sort((a, b) => a.order - b.order);
  }, [page.fields]);

  /**
   * Check if a field should be visible based on conditional visibility rules
   */
  const isFieldVisible = (field: FormPageField): boolean => {
    // Default visibility
    if (field.visible === false) return false;

    // Check conditional visibility
    if (field.conditionalVisibility) {
      const { dependsOn, operator, value: expectedValue } = field.conditionalVisibility;
      const dependencyField = tableFieldMap.get(dependsOn);
      if (!dependencyField) return true; // If dependency not found, show field

      const actualValue = formData[dependencyField.name];

      switch (operator) {
        case 'equals':
          return actualValue === expectedValue;
        case 'not_equals':
          return actualValue !== expectedValue;
        case 'is_empty':
          return actualValue === null || actualValue === undefined || actualValue === '';
        case 'is_not_empty':
          return actualValue !== null && actualValue !== undefined && actualValue !== '';
        case 'contains':
          if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
            return actualValue.includes(expectedValue);
          }
          return false;
        default:
          return true;
      }
    }

    return true;
  };

  /**
   * Render a field based on its type
   */
  const renderField = (fieldConfig: FormPageField) => {
    const tableField = tableFieldMap.get(fieldConfig.fieldId);
    if (!tableField) return null;

    // Check visibility
    if (!isFieldVisible(fieldConfig)) return null;

    const fieldName = tableField.name;
    const fieldValue = formData[fieldName];
    const fieldError = errors[fieldName];

    // Determine if field is required (form config overrides table field)
    const isRequired = fieldConfig.required !== undefined
      ? fieldConfig.required
      : (tableField.required ?? false);

    // Common props for all field types
    const commonProps = {
      fieldId: tableField.id,
      name: fieldName,
      label: fieldConfig.label,
      helpText: fieldConfig.helpText,
      placeholder: fieldConfig.placeholder,
      required: isRequired,
      error: fieldError,
      className: "w-full",
    };

    // Render based on field type
    switch (tableField.type) {
      case 'text':
        return (
          <TextFieldInput
            key={tableField.id}
            {...commonProps}
            value={fieldValue || ''}
            onChange={(value) => onChange(fieldName, value)}
          />
        );

      case 'number':
        return (
          <NumberFieldInput
            key={tableField.id}
            {...commonProps}
            value={fieldValue ?? null}
            onChange={(value) => onChange(fieldName, value)}
          />
        );

      case 'boolean':
        return (
          <BooleanFieldInput
            key={tableField.id}
            {...commonProps}
            value={fieldValue ?? false}
            onChange={(value) => onChange(fieldName, value)}
          />
        );

      case 'date':
        return (
          <DateFieldInput
            key={tableField.id}
            {...commonProps}
            value={fieldValue || null}
            onChange={(value) => onChange(fieldName, value)}
          />
        );

      case 'single-select':
        return (
          <SingleSelectFieldInput
            key={tableField.id}
            {...commonProps}
            value={fieldValue ?? null}
            onChange={(value) => onChange(fieldName, value)}
            options={(tableField.metadata?.options as SelectOption[] | undefined) || []}
          />
        );

      case 'multi-select':
        return (
          <MultiSelectFieldInput
            key={tableField.id}
            {...commonProps}
            value={fieldValue ?? null}
            onChange={(value) => onChange(fieldName, value)}
            options={(tableField.metadata?.options as SelectOption[] | undefined) || []}
            maxSelections={tableField.metadata?.maxSelections as number | undefined}
          />
        );

      default:
        // For unsupported field types, render text input as fallback
        return (
          <TextFieldInput
            key={tableField.id}
            {...commonProps}
            value={fieldValue || ''}
            onChange={(value) => onChange(fieldName, value)}
          />
        );
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Page Title */}
      {page.title && (
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{page.title}</h2>
          {page.description && (
            <p className="text-muted-foreground">{page.description}</p>
          )}
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {sortedFields.map(field => renderField(field))}
      </div>
    </div>
  );
}
