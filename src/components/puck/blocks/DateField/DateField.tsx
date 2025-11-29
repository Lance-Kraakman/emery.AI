'use client';

/**
 * DateField - Field Block Component
 *
 * Displays formatted date from date field values from the nearest data context.
 * Must be used inside DataContextBlock or RepeatBlock.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { cn } from '@/lib/utils';
import styles from './styles.module.css';

export interface DateFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  format?: 'short' | 'long' | 'relative' | 'time';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  textColor?: string;
  fontFamily?: string;
  fontWeight?: string;
  fallback?: string;
}

export default function DateField({
  fieldId,
  label,
  labelPosition = 'top',
  format = 'short',
  size = 'base',
  textColor,
  fontFamily,
  fontWeight,
  fallback = '',
}: DateFieldProps) {
  // All hooks must be called before any conditionals (React hooks rules)
  const isInContext = useIsInDataContext();
  const value = useFieldValue(fieldId ?? 0);

  // No field selected
  if (fieldId === undefined) {
    return (
      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span className={styles.warningText}>Please select a field</span>
      </div>
    );
  }

  // Not in data context - show warning
  if (!isInContext) {
    return (
      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span className={styles.warningText}>
          DateField must be inside a Data block
        </span>
      </div>
    );
  }

  // Get display value
  let displayValue = fallback;

  if (value) {
    try {
      const date = new Date(value);

      if (!isNaN(date.getTime())) {
        switch (format) {
          case 'short':
            displayValue = date.toLocaleDateString();
            break;
          case 'long':
            displayValue = date.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            break;
          case 'time':
            displayValue = date.toLocaleString();
            break;
          case 'relative':
            displayValue = getRelativeTime(date);
            break;
          default:
            displayValue = date.toLocaleDateString();
        }
      }
    } catch (error) {
      console.error('[DateField] Error formatting date:', error);
      displayValue = String(value);
    }
  }

  const containerClass = cn(
    styles.dateField,
    labelPosition === 'inline' && styles.inline
  );

  // Build inline styles from standard fields
  const dateStyle: React.CSSProperties = {
    ...(textColor && { color: textColor }),
    ...(fontFamily && { fontFamily }),
    ...(fontWeight && { fontWeight }),
  };

  return (
    <div className={containerClass}>
      {label && <label className={styles.label}>{label}</label>}
      <span className={styles.date} data-size={size} style={dateStyle}>
        {displayValue}
      </span>
    </div>
  );
}

// Helper function for relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}
