'use client'

import { useForm } from '@tanstack/react-form';
import { Save, X } from 'lucide-react';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FieldInput from './FieldInput';

interface RowFormProps {
  fields: FieldDTO[];
  rowData: Record<string, any>;
  onFieldChange: (fieldSlug: string, value: any) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  title: string;
  tableId: number;
  organizationId: number;
  submitLabel?: string;
}

export default function RowForm({
  fields,
  rowData,
  onFieldChange,
  onSubmit,
  onCancel,
  isPending,
  title,
  tableId,
  organizationId,
  submitLabel = 'Save'
}: RowFormProps) {
  const form = useForm({
    defaultValues: rowData,
    onSubmit: async ({ value }) => {
      const formData = new FormData();
      formData.append('tableId', tableId.toString());
      
      Object.entries(value).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          formData.append(key, val.toString());
        }
      });
      
      await onSubmit(formData);
    },
  });

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }} className="space-y-4">
          
          {fields.map((field) => (
            <form.Field
              key={field.id}
              name={field.name}
              validators={{
                onChange: field.required ? 
                  ({ value }) => !value || value === '' ? 'This field is required' : undefined :
                  undefined
              }}
            >
              {(fieldApi) => (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {field.name}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <FieldInput
                    field={field}
                    value={fieldApi.state.value || ''}
                    onChange={(value) => {
                      fieldApi.handleChange(value);
                      onFieldChange(field.name, value);
                    }}
                    disabled={isPending}
                    organizationId={organizationId}
                    tableId={tableId}
                  />
                  {fieldApi.state.meta.errors.length > 0 && (
                    <div className="text-sm text-destructive">
                      {fieldApi.state.meta.errors[0]}
                    </div>
                  )}
                </div>
              )}
            </form.Field>
          ))}
          
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isPending || form.state.isSubmitting}
              variant="default"
              size="sm"
            >
              <Save size={16} />
              {isPending || form.state.isSubmitting ? 'Saving...' : submitLabel}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              disabled={isPending || form.state.isSubmitting}
              variant="outline"
              size="sm"
            >
              <X size={16} />
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
