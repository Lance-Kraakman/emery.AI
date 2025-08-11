'use client'

import { Field } from '@/app/actions/types';
import FileUpload from '../FileUpload';
import RelationField from './RelationField';

interface FieldInputProps {
  field: Field;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  organizationId?: number;
  tableId?: number;
}

export default function FieldInput({ 
  field, 
  value, 
  onChange, 
  disabled = false,
  organizationId,
  tableId 
}: FieldInputProps) {
  const baseClass = "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  
  switch (field.type) {
    case 'number':
      return (
        <input
          type="number"
          name={field.slug}
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          className={baseClass}
          disabled={disabled}
        />
      );
    case 'boolean':
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            name={field.slug}
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
      );
    case 'date':
      return (
        <input
          type="date"
          name={field.slug}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          disabled={disabled}
        />
      );
    case 'email':
      return (
        <input
          type="email"
          name={field.slug}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          disabled={disabled}
        />
      );
    case 'url':
      return (
        <input
          type="url"
          name={field.slug}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          disabled={disabled}
        />
      );
    case 'file':
      if (!organizationId || !tableId) {
        console.warn('FileUpload requires organizationId and tableId');
        return <div className="text-red-500">File upload configuration error</div>;
      }
      return (
        <FileUpload
          value={value}
          onChange={onChange}
          organizationId={organizationId}
          tableId={tableId}
          fieldId={field.id}
        />
      );
    case 'relation':
      if (!organizationId) {
        console.warn('RelationField requires organizationId');
        return <div className="text-red-500">Relation field configuration error</div>;
      }
      return (
        <RelationField
          value={value}
          onChange={onChange}
          relatedTableId={field.relatedTableId}
          workspaceId={organizationId}
          disabled={disabled}
        />
      );
    default:
      return (
        <input
          type="text"
          name={field.slug}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          disabled={disabled}
        />
      );
  }
}