/**
 * MetricConfigurationSection Component
 *
 * Configuration panel for metric views.
 * Allows users to configure aggregation settings including:
 * - Which field to aggregate
 * - Aggregation type (sum, avg, count, etc.)
 * - Custom label
 * - Display format (number, currency, percentage, duration)
 * - Decimal places
 */

import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { AggregationType, FormatType } from '@/ddd/domain/views/value-objects/aggregation-config';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FieldSelector } from './FieldSelector';
import { AggregationTypeSelector } from './AggregationTypeSelector';
import { FormatTypeSelector } from './FormatTypeSelector';

interface MetricConfigurationSectionProps {
  fields: FieldDTO[];
  loadingFields: boolean;
  selectedFieldId?: number;
  onFieldChange: (fieldId: number) => void;
  aggregationType: AggregationType;
  onAggregationTypeChange: (type: AggregationType) => void;
  customLabel: string;
  onCustomLabelChange: (label: string) => void;
  formatType: FormatType;
  onFormatTypeChange: (type: FormatType) => void;
  decimals: number;
  onDecimalsChange: (decimals: number) => void;
  isSubmitting: boolean;
}

export function MetricConfigurationSection({
  fields,
  loadingFields,
  selectedFieldId,
  onFieldChange,
  aggregationType,
  onAggregationTypeChange,
  customLabel,
  onCustomLabelChange,
  formatType,
  onFormatTypeChange,
  decimals,
  onDecimalsChange,
  isSubmitting,
}: MetricConfigurationSectionProps) {
  return (
    <div className="space-y-4 border rounded-md p-4 bg-secondary/10">
      <h4 className="text-sm font-medium">Metric Configuration</h4>

      {/* Field Selection */}
      <FieldSelector
        fields={fields}
        value={selectedFieldId}
        onChange={onFieldChange}
        loading={loadingFields}
        disabled={isSubmitting}
        label="Field to Aggregate"
        required
        placeholder="Select a field"
      />

      {/* Aggregation Type */}
      <AggregationTypeSelector
        value={aggregationType}
        onChange={onAggregationTypeChange}
        disabled={isSubmitting}
      />

      {/* Custom Label */}
      <div className="space-y-2">
        <Label htmlFor="customLabel">Custom Label (Optional)</Label>
        <Input
          id="customLabel"
          value={customLabel}
          onChange={(e) => onCustomLabelChange(e.target.value)}
          placeholder="e.g., Total Sales"
          disabled={isSubmitting}
        />
      </div>

      {/* Format Type */}
      <FormatTypeSelector
        value={formatType}
        onChange={onFormatTypeChange}
        disabled={isSubmitting}
      />

      {/* Decimal Places */}
      <div className="space-y-2">
        <Label htmlFor="decimals">Decimal Places</Label>
        <Input
          id="decimals"
          type="number"
          min="0"
          max="10"
          value={decimals}
          onChange={(e) => onDecimalsChange(parseInt(e.target.value) || 0)}
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
}
