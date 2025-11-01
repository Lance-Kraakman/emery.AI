/**
 * AggregationTypeSelector Component
 *
 * Reusable component for selecting aggregation type for metrics.
 * Centralizes the list of available aggregation functions.
 */

import type { AggregationType } from '@/ddd/domain/views/value-objects/aggregation-config';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AggregationTypeSelectorProps {
  value: AggregationType;
  onChange: (type: AggregationType) => void;
  disabled?: boolean;
  label?: string;
}

const AGGREGATION_OPTIONS: Array<{ value: AggregationType; label: string }> = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count_distinct', label: 'Count Distinct' },
  { value: 'count_empty', label: 'Count Empty' },
  { value: 'count_not_empty', label: 'Count Not Empty' },
];

export function AggregationTypeSelector({
  value,
  onChange,
  disabled = false,
  label = 'Aggregation Type',
}: AggregationTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as AggregationType)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AGGREGATION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
