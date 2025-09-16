'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BaseModal } from '@/app/(app)/agents/components/modals/BaseModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  TextFieldInput,
  NumberFieldInput,
  BooleanFieldInput,
  DateFieldInput,
  FileFieldInput,
  DocumentFieldInput,
  RelationFieldInput
} from './field-inputs';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { RowDTO, TypedFieldValueDTO, FieldValueDTO } from '@/app/mappers/row-mapper';
import type {
  DateFieldValue,
  FileArrayFieldValue,
  DocumentArrayFieldValue,
  RelationArrayFieldValue
} from '@/ddd/domain/tables/value-objects/field-values';

interface RowEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  fields: FieldDTO[];
  rowData?: RowDTO; // undefined for create mode
  mode: 'create' | 'edit';
  onSave: (fieldValues: TypedFieldValueDTO[]) => Promise<boolean>;
}

interface FormData {
  [fieldId: string]: FieldValueDTO;
}

interface FormErrors {
  [fieldId: string]: string;
}

export function RowEditorModal({
  isOpen,
  onClose,
  fields,
  rowData,
  mode,
  onSave
}: RowEditorModalProps) {
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sort fields by order index (memoized to prevent infinite useEffect loops)
  const sortedFields = useMemo(() =>
    [...fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)),
    [fields]
  );

  // Initialize form data
  useEffect(() => {
    if (!isOpen) return;

    const initialData: FormData = {};

    if (mode === 'edit' && rowData) {
      // Populate with existing data
      const fieldValueMap = new Map<number, TypedFieldValueDTO>();
      rowData.fieldValues.forEach(fv => {
        const field = fields.find(f => f.name === fv.fieldSlug || f.id.toString() === fv.fieldSlug);
        if (field) {
          fieldValueMap.set(field.id, fv);
        }
      });

      sortedFields.forEach(field => {
        const existingValue = fieldValueMap.get(field.id);
        initialData[field.id.toString()] = existingValue?.value ?? getDefaultValue(field.type);
      });
    } else {
      // Initialize with default values for create mode
      sortedFields.forEach(field => {
        initialData[field.id.toString()] = getDefaultValue(field.type);
      });
    }

    setFormData(initialData);
    setErrors({});
  }, [isOpen, mode, rowData, fields, sortedFields]);

  const getDefaultValue = (fieldType: string): FieldValueDTO => {
    switch (fieldType) {
      case 'text':
        return '';
      case 'number':
        return null;
      case 'boolean':
        return false;
      case 'date':
        return null;
      case 'file':
      case 'document':
      case 'relation':
        return [];
      default:
        return null;
    }
  };

  const validateField = (field: FieldDTO, value: FieldValueDTO): string | null => {
    if (field.required) {
      switch (field.type) {
        case 'text':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return `${field.name} is required`;
          }
          break;
        case 'number':
          if (value === null || value === undefined) {
            return `${field.name} is required`;
          }
          break;
        case 'boolean':
          // Boolean fields are always valid (true/false)
          break;
        case 'date':
          if (!value) {
            return `${field.name} is required`;
          }
          break;
        case 'file':
        case 'document':
        case 'relation':
          if (!Array.isArray(value) || value.length === 0) {
            return `${field.name} is required`;
          }
          break;
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    sortedFields.forEach(field => {
      const value = formData[field.id.toString()];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.id.toString()] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleFieldChange = (fieldId: string, value: FieldValueDTO) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));

    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert form data to TypedFieldValueDTO array
      const fieldValues: TypedFieldValueDTO[] = sortedFields.map(field => {
        const value = formData[field.id.toString()];
        return {
          fieldSlug: field.name, // Use field name as slug
          value,
          fieldType: field.type as TypedFieldValueDTO['fieldType']
        };
      });

      const success = await onSave(fieldValues);

      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Error saving row:', error);
      // TODO: Show error message to user
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldInput = (field: FieldDTO) => {
    const fieldId = field.id.toString();
    const value = formData[fieldId];
    const error = errors[fieldId];

    const commonProps = {
      value,
      onChange: (newValue: FieldValueDTO) => handleFieldChange(fieldId, newValue),
      required: field.required || false,
      error
    };

    switch (field.type) {
      case 'text':
        return (
          <TextFieldInput
            {...commonProps}
            value={value as string || ''}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            multiline={field.metadata?.multiline as boolean}
          />
        );
      case 'number':
        return (
          <NumberFieldInput
            {...commonProps}
            value={value as number}
            min={field.metadata?.min as number}
            max={field.metadata?.max as number}
            step={field.metadata?.step as number}
          />
        );
      case 'boolean':
        return (
          <BooleanFieldInput
            value={value as boolean || false}
            onChange={commonProps.onChange}
            required={commonProps.required}
            error={commonProps.error}
            label={`Enable ${field.name}`}
          />
        );
      case 'date':
        return (
          <DateFieldInput
            value={value as DateFieldValue}
            onChange={commonProps.onChange}
            required={commonProps.required}
            error={commonProps.error}
          />
        );
      case 'file':
        return (
          <FileFieldInput
            value={value as FileArrayFieldValue || []}
            onChange={commonProps.onChange}
            required={commonProps.required}
            error={commonProps.error}
            allowedTypes={field.metadata?.allowedTypes as string[]}
            maxFiles={field.metadata?.maxFiles as number}
          />
        );
      case 'document':
        return (
          <DocumentFieldInput
            value={value as DocumentArrayFieldValue || []}
            onChange={commonProps.onChange}
            required={commonProps.required}
            error={commonProps.error}
            field={field}
            organizationId={1} // TODO: Get from context/props
            tableId={1} // TODO: Get from context/props
          />
        );
      case 'relation':
        return (
          <RelationFieldInput
            value={value as RelationArrayFieldValue || []}
            onChange={commonProps.onChange}
            required={commonProps.required}
            error={commonProps.error}
            relatedTableId={field.relatedTableId || undefined}
            multiple={field.metadata?.multiple !== false}
          />
        );
      default:
        return (
          <div className="text-muted-foreground italic">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <Button
        variant="outline"
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="row-editor-form"
        disabled={isSubmitting}
        className="flex items-center gap-2"
      >
        <Save className="h-4 w-4" />
        {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Row' : 'Save Changes'}
      </Button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create New Row' : 'Edit Row'}
      description={`${mode === 'create' ? 'Add a new row' : 'Modify the existing row'} with the fields below`}
      size="lg"
      footer={footer}
    >
      <form id="row-editor-form" onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
        {sortedFields.map((field) => (
          <Card key={field.id} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={`field-${field.id}`} className="text-base font-medium">
                  {field.name}
                  {field.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                <Badge variant="outline" className="text-xs">
                  {field.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div id={`field-${field.id}`}>
                {renderFieldInput(field)}
              </div>
            </CardContent>
          </Card>
        ))}

        {sortedFields.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No fields defined for this table. Add fields first to create rows.
          </div>
        )}
      </form>
    </BaseModal>
  );
}