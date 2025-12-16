'use client';

/**
 * NumberField - Field Block Component
 *
 * Displays number field values from the nearest data context.
 * Must be used inside DataBlock.
 * Supports formatting options like decimal places, prefix, suffix.
 *
 * Edit Mode: When inside an EditableRowProvider with isEditMode=true,
 * renders as a number input instead of display text.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { useEditableRow } from '@/components/puck/contexts/EditableRowContext';
import { useFieldMetadata } from '@/components/puck/hooks/useFieldMetadata';
import { NumberInput } from '@/components/forms/inputs/NumberInput';
import { cn } from '@/lib/utils';
import styles from './styles.module.css';

export interface NumberFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  textColor?: string;
  fontFamily?: string;
  fontWeight?: string;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  useGrouping?: boolean;
  fallback?: string;
}

export default function NumberField({
  fieldId,
  label,
  labelPosition = 'top',
  size = 'base',
  textColor,
  fontFamily,
  fontWeight,
  decimalPlaces,
  prefix = '',
  suffix = '',
  useGrouping = true,
  fallback = '',
}: NumberFieldProps) {
  // All hooks must be called before any conditionals (React hooks rules)
  const isInContext = useIsInDataContext();
  const value = useFieldValue(fieldId ?? 0);
  const editable = useEditableRow();
  const field = useFieldMetadata(fieldId);

  // No field selected
  if (fieldId === undefined) {
    return (
      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span>Please select a field</span>
      </div>
    );
  }

  // Not in data context - show warning
  if (!isInContext) {
    return (
      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span className={styles.warningText}>
          NumberField must be inside a Data block
        </span>
      </div>
    );
  }

  // ============================================
  // EDIT MODE: Render as uncontrolled input
  // ============================================
  if (editable?.isEditMode && field) {
    const initialValue = value === '' || value === undefined || value === null ? null : Number(value);

    return (
      <div className={styles.editContainer}>
        <NumberInput
          field={field}
          name={field.name}
          defaultValue={initialValue}
          label={label || field.name}
          disabled={editable.isSaving}
        />
      </div>
    );
  }

  // ============================================
  // DISPLAY MODE: Render as formatted text
  // ============================================

  // Get display value
  let displayValue: string;

  if (value === null || value === undefined || value === '') {
    displayValue = fallback;
  } else {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));

    if (isNaN(numValue)) {
      displayValue = fallback;
    } else {
      // Format the number
      const formatOptions: Intl.NumberFormatOptions = {
        useGrouping,
      };

      if (decimalPlaces !== undefined) {
        formatOptions.minimumFractionDigits = decimalPlaces;
        formatOptions.maximumFractionDigits = decimalPlaces;
      }

      displayValue = `${prefix}${numValue.toLocaleString(undefined, formatOptions)}${suffix}`;
    }
  }

  const containerClass = cn(
    styles.numberField,
    labelPosition === 'inline' && styles.inline
  );

  // Build inline styles from standard fields
  const textStyle: React.CSSProperties = {
    ...(textColor && { color: textColor }),
    ...(fontFamily && { fontFamily }),
    ...(fontWeight && { fontWeight }),
  };

  return (
    <div className={containerClass}>
      {label && <label className={styles.label}>{label}</label>}
      <span className={styles.text} data-size={size} style={textStyle}>
        {displayValue}
      </span>
    </div>
  );
}
