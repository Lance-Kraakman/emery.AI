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
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  textColor?: string;
  fontFamily?: string;
  fontWeight?: string;
  maxLength?: number;
  fallback?: string;
}

export default function TextField({
  fieldId,
  label,
  labelPosition = 'top',
  size = 'base',
  textColor,
  fontFamily,
  fontWeight,
  maxLength,
  fallback = '',
}: TextFieldProps) {
  // All hooks must be called before any conditionals (React hooks rules)
  const isInContext = useIsInDataContext();
  const value = useFieldValue(fieldId ?? 0);

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
          TextField must be inside a Data block
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

  const containerClass = cn(
    styles.textField,
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
