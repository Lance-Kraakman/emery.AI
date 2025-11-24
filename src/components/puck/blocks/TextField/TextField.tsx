'use client';

/**
 * TextField - Field Block Component
 *
 * Displays text/email field values from the nearest data context.
 * Must be used inside DataContextBlock or RepeatBlock.
 *
 * This is a specialized block for displaying text data - it's field-type aware
 * and automatically handles data binding through context.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { cn } from '@/lib/utils';
import styles from './styles.module.css';

export interface TextFieldProps {
  fieldId: number;
  label?: string;
  style?: 'default' | 'bold' | 'muted' | 'heading';
  maxLength?: number;
  fallback?: string;
}

export default function TextField({
  fieldId,
  label,
  style = 'default',
  maxLength,
  fallback = '',
}: TextFieldProps) {
  const isInContext = useIsInDataContext();
  const value = useFieldValue(fieldId);

  // Not in data context - show warning
  if (!isInContext) {
    return (
      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span className={styles.warningText}>
          TextField must be inside a DataContextBlock or RepeatBlock
        </span>
      </div>
    );
  }

  // Get display value
  let displayValue = value ?? fallback;

  // Handle different value types
  if (displayValue === null || displayValue === undefined) {
    displayValue = fallback;
  } else if (typeof displayValue === 'object') {
    displayValue = JSON.stringify(displayValue);
  } else {
    displayValue = String(displayValue);
  }

  // Truncate if maxLength specified
  if (maxLength && displayValue.length > maxLength) {
    displayValue = displayValue.substring(0, maxLength) + '...';
  }

  const textClass = cn(
    styles.text,
    {
      [styles.bold]: style === 'bold',
      [styles.muted]: style === 'muted',
      [styles.heading]: style === 'heading',
    }
  );

  return (
    <div className={styles.textField}>
      {label && <label className={styles.label}>{label}</label>}
      <span className={textClass}>{displayValue}</span>
    </div>
  );
}
