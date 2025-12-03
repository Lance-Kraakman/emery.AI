'use client';

/**
 * SelectField - Field Block Component
 *
 * Displays select option values as badges/pills from the nearest data context.
 * Must be used inside DataContextBlock or RepeatBlock.
 *
 * Handles both single-select and multi-select fields.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { cn } from '@/lib/utils';
import styles from './styles.module.css';

export interface SelectFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  textColor?: string;
  fontFamily?: string;
  fontWeight?: string;
  backgroundColor?: string;
  fallback?: string;
}

export default function SelectField({
  fieldId,
  label,
  labelPosition = 'top',
  size = 'sm',
  textColor,
  fontFamily,
  fontWeight,
  backgroundColor,
  fallback = '',
}: SelectFieldProps) {
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
          SelectField must be inside a Data block
        </span>
      </div>
    );
  }

  // Parse select field value
  // Select fields can be:
  // - Single value: { id: 1, value: "Active", color: "#green" }
  // - Multiple values: [{ id: 1, value: "Tag1", color: "#blue" }, ...]
  // - Or just the value string/number directly

  let options: Array<{ value: string; color?: string }> = [];

  if (!value) {
    if (fallback) {
      options = [{ value: fallback }];
    }
  } else if (Array.isArray(value)) {
    // Multi-select
    options = value.map(item => {
      if (typeof item === 'object' && item !== null) {
        return {
          value: item.value || String(item),
          color: item.color
        };
      }
      return { value: String(item) };
    });
  } else if (typeof value === 'object' && value !== null) {
    // Single select object
    options = [{
      value: value.value || String(value),
      color: value.color
    }];
  } else {
    // Plain value
    options = [{ value: String(value) }];
  }

  const containerClass = cn(
    styles.selectField,
    labelPosition === 'inline' && styles.inline
  );

  // Build custom styles
  const customStyles: React.CSSProperties = {
    ...(fontFamily && { fontFamily }),
    ...(fontWeight && { fontWeight }),
  };

  return (
    <div className={containerClass} style={customStyles}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.badges} data-size={size}>
        {options.map((option, index) => {
          // Priority: option.color > backgroundColor prop > default
          const bgColor = option.color || backgroundColor;
          const badgeStyle: React.CSSProperties = {
            ...(bgColor && {
              backgroundColor: bgColor,
              color: textColor || getContrastColor(bgColor)
            }),
            ...(textColor && !bgColor && { color: textColor }),
          };

          return (
            <span
              key={index}
              className={styles.badge}
              style={Object.keys(badgeStyle).length > 0 ? badgeStyle : undefined}
            >
              {option.value}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Helper to determine text color based on background
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
