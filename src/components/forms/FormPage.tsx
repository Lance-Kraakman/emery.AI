'use client';

/**
 * FormPage - Renders a single page in a multi-page form
 *
 * AIDEV-NOTE: This component renders all fields for a single form page.
 * Handles conditional field visibility based on other field values.
 * Uses the field input components for rendering different field types.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getInputComponentForField, getDefaultValueForField } from './input-mapper';
import type { InputThemeClasses } from './input-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';

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
  allowMultiple?: boolean;
  maxFiles?: number;
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
  themeClasses?: InputThemeClasses;
}

export function FormPage({
  page,
  tableFields,
  formData,
  errors,
  onChange,
  className,
  themeClasses,
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
   * Render a field based on its type using input mapper
   */
  const renderField = (fieldConfig: FormPageField) => {
    const tableField = tableFieldMap.get(fieldConfig.fieldId);
    if (!tableField) return null;

    // Check visibility
    if (!isFieldVisible(fieldConfig)) return null;

    const fieldName = tableField.name;
    const fieldValue = formData[fieldName] ?? getDefaultValueForField(tableField as FieldDTO);
    const fieldError = errors[fieldName];

    // Determine if field is required (form config overrides table field)
    const isRequired = fieldConfig.required !== undefined
      ? fieldConfig.required
      : (tableField.required ?? false);

    // Get the appropriate input component for this field type
    const InputComponent = getInputComponentForField(tableField as FieldDTO);

    // Build form field options for file upload overrides
    const formFieldOptions = (fieldConfig.allowMultiple !== undefined || fieldConfig.maxFiles !== undefined)
      ? { allowMultiple: fieldConfig.allowMultiple, maxFiles: fieldConfig.maxFiles }
      : undefined;

    return (
      <div key={tableField.id} className="w-full">
        <InputComponent
          field={tableField as FieldDTO}
          value={fieldValue}
          onChange={(value) => onChange(fieldName, value)}
          label={fieldConfig.label || tableField.name}
          placeholder={fieldConfig.placeholder}
          required={isRequired}
          themeClasses={themeClasses}
          formFieldOptions={formFieldOptions}
        />
        {fieldError && (
          <p className={themeClasses?.error || "text-sm text-destructive mt-1"}>{fieldError}</p>
        )}
        {fieldConfig.helpText && !fieldError && (
          <p className="text-sm text-muted-foreground mt-1">{fieldConfig.helpText}</p>
        )}
      </div>
    );
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
