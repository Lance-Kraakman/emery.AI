/**
 * FormatTypeSelector Component
 *
 * Reusable component for selecting display format type for numeric values.
 * Used for metric configuration to determine how values are formatted.
 */

import type { FormatType } from '@/ddd/domain/views/value-objects/aggregation-config';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormatTypeSelectorProps {
  value: FormatType;
  onChange: (type: FormatType) => void;
  disabled?: boolean;
  label?: string;
}

const FORMAT_OPTIONS: Array<{ value: FormatType; label: string }> = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'duration', label: 'Duration' },
];

export function FormatTypeSelector({
  value,
  onChange,
  disabled = false,
  label = 'Display Format',
}: FormatTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as FormatType)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
