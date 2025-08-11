'use client'

import { Save, X } from 'lucide-react';
import { Field } from '@/app/actions/types';
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
    <div className="mb-6 p-4 border rounded-lg bg-gray-50">
      <h4 className="font-medium mb-3">{title}</h4>
      <form action={onSubmit} className="space-y-3">
        <input type="hidden" name="tableId" value={tableId} />
        
        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
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
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} />
            {isPending ? 'Saving...' : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={16} />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}