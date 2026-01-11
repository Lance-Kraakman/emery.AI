'use client';

/**
 * CreateRowDialog - Dialog for creating new rows in DataBlock
 *
 * Renders a dialog with form inputs for all editable fields.
 * Uses the input-mapper to get appropriate input components for each field type.
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  getInputComponentForField,
  isFieldEditable,
  getDefaultValueForField,
} from '@/components/forms/input-mapper';
import { validateField } from '@/components/puck/utils/field-validation';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface CreateRowDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<number, unknown>) => Promise<void>;
  fields: FieldDTO[];
  isSaving: boolean;
  errors: Record<string, string>;
}

export function CreateRowDialog({
  open,
  onClose,
  onSave,
  fields,
  isSaving,
  errors,
}: CreateRowDialogProps) {
  // Local form state
  const [formData, setFormData] = useState<Record<number, unknown>>({});
  const [localErrors, setLocalErrors] = useState<Record<number, string>>({});

  // Get editable fields only
  const editableFields = useMemo(() => {
    return fields.filter(f => isFieldEditable(f.type));
  }, [fields]);

  // Initialize form data with defaults
  const initializeForm = () => {
    const defaults: Record<number, unknown> = {};
    editableFields.forEach(field => {
      defaults[field.id] = getDefaultValueForField(field);
    });
    setFormData(defaults);
    setLocalErrors({});
  };

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      initializeForm();
    } else {
      onClose();
    }
  };

  // Update field value
  const handleFieldChange = (fieldId: number, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear error when value changes
    setLocalErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });
  };

  // Validate and save
  const handleSave = async () => {
    // Validate all fields
    const validationErrors: Record<number, string> = {};
    let hasErrors = false;

    editableFields.forEach(field => {
      const value = formData[field.id];
      const error = validateField(field, value);
      if (error) {
        validationErrors[field.id] = error;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setLocalErrors(validationErrors);
      return;
    }

    // Save the data
    await onSave(formData);
  };

  // Merge local and external errors
  const allErrors = { ...localErrors };
  if (errors._form) {
    // Form-level error from save attempt
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Row</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Form-level error */}
          {errors._form && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
              {errors._form}
            </div>
          )}

          {/* Field inputs */}
          {editableFields.map(field => {
            const InputComponent = getInputComponentForField(field);
            const value = formData[field.id];
            const error = allErrors[field.id];

            return (
              <div key={field.id} className="space-y-1">
                <InputComponent
                  field={field}
                  value={value}
                  onChange={(newValue) => handleFieldChange(field.id, newValue)}
                  label={field.name}
                  required={field.required ?? undefined}
                  disabled={isSaving}
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
              </div>
            );
          })}

          {editableFields.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">
              No editable fields available
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || editableFields.length === 0}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
