'use client';

/**
 * TypeAwareOperatorSelector - Operator selector that filters by field type
 *
 * Shows only operators that make sense for the selected field type.
 * Falls back to all operators if field type is unknown.
 */

import React from 'react';
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import type { ConditionOperator } from '../blocks/ConditionalBlock';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Operators available for each field type
 */
const OPERATORS_BY_TYPE: Record<FieldType | 'id' | 'unknown', ConditionOperator[]> = {
  // Built-in ID field
  'id': ['eq', 'ne', 'truthy', 'falsy'],

  // Text-like types
  'text': ['eq', 'ne', 'contains', 'truthy', 'falsy'],
  'email': ['eq', 'ne', 'contains', 'truthy', 'falsy'],
  'phone': ['eq', 'ne', 'contains', 'truthy', 'falsy'],

  // Number types
  'number': ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy'],
  'autonumber': ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],

  // Boolean
  'boolean': ['truthy', 'falsy', 'eq'],

  // Date types
  'date': ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy'],
  'last-updated': ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  'created-at': ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],

  // Relation (single or multiple linked records)
  'relation': ['truthy', 'falsy', 'contains', 'eq'],

  // Select types
  'single-select': ['eq', 'ne', 'truthy', 'falsy'],
  'multi-select': ['contains', 'truthy', 'falsy'],

  // File types
  'file': ['truthy', 'falsy'],
  'document': ['truthy', 'falsy'],

  // Special types
  'embedding': ['truthy', 'falsy'],
  'json': ['truthy', 'falsy'],

  // Default/unknown - show all operators
  'unknown': ['truthy', 'falsy', 'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'],
};

/**
 * Human-readable operator labels
 */
const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  'truthy': 'Has Value',
  'falsy': 'Is Empty',
  'eq': 'Equals',
  'ne': 'Not Equals',
  'gt': 'Greater Than',
  'gte': 'Greater or Equal',
  'lt': 'Less Than',
  'lte': 'Less or Equal',
  'contains': 'Contains',
};

interface TypeAwareOperatorSelectorProps {
  value: ConditionOperator | undefined;
  onChange: (value: ConditionOperator) => void;
  /** Field name to determine type (for rowData source) */
  fieldName?: string;
  /** Source type to determine context */
  sourceType?: 'state' | 'params' | 'rowData';
  disabled?: boolean;
}

export function TypeAwareOperatorSelector({
  value,
  onChange,
  fieldName,
  sourceType = 'rowData',
  disabled = false,
}: TypeAwareOperatorSelectorProps) {
  const dataContext = useDataLayoutContext();

  // Determine field type
  const fieldType = React.useMemo((): FieldType | 'id' | 'unknown' => {
    // For state variables, we don't have type info yet - show all
    if (sourceType === 'state' || sourceType === 'params') {
      return 'unknown';
    }

    // For rowData source
    if (fieldName === 'id') {
      return 'id';
    }

    if (!fieldName || !dataContext?.fields) {
      return 'unknown';
    }

    const field = dataContext.fields.find(f => f.name === fieldName);
    return field?.type || 'unknown';
  }, [sourceType, fieldName, dataContext?.fields]);

  // Get available operators for this field type
  const availableOperators = OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE['unknown'];

  // If current value is not in available operators, select first available
  React.useEffect(() => {
    if (value && !availableOperators.includes(value)) {
      onChange(availableOperators[0]);
    }
  }, [availableOperators, value, onChange]);

  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as ConditionOperator)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="Select operator...">
          {value && OPERATOR_LABELS[value]}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableOperators.map((op) => (
          <SelectItem key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default TypeAwareOperatorSelector;
