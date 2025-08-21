'use client'

import { Save, X } from 'lucide-react';
import type { Field } from '@/lib/domain/entities/field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FieldInput from './FieldInput';

interface RowFormProps {
  fields: Field[];
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
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="tableId" value={tableId} />
          
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label className="text-sm font-medium">
                {field.name}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <FieldInput
                field={field}
                value={rowData[field.slug] || ''}
                onChange={(value) => onFieldChange(field.slug, value)}
                disabled={isPending}
                organizationId={organizationId}
                tableId={tableId}
              />
            </div>
          ))}
          
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isPending}
              variant="default"
              size="sm"
            >
              <Save size={16} />
              {isPending ? 'Saving...' : submitLabel}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              disabled={isPending}
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
