/**
 * FieldSelector Component
 *
 * Reusable component for selecting a field from a table.
 * Displays field name and type for better UX.
 */

import type { FieldDTO } from '@/app/mappers/field-mapper';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FieldSelectorProps {
  fields: FieldDTO[];
  value?: number;
  onChange: (fieldId: number) => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

export function FieldSelector({
  fields,
  value,
  onChange,
  loading = false,
  disabled = false,
  label = 'Field',
  required = false,
  placeholder = 'Select a field',
}: FieldSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Select
        value={value?.toString()}
        onValueChange={(val) => onChange(parseInt(val))}
        disabled={disabled || loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading fields...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.id.toString()}>
              {field.name} ({field.type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
