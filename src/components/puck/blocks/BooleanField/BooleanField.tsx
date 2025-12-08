'use client';

/**
 * BooleanField - Field Block Component
 *
 * Displays boolean field values from the nearest data context.
 * Must be used inside DataBlock.
 * Supports different display styles: text, badge, icon.
 *
 * Edit Mode: When inside an EditableRowProvider with isEditMode=true,
 * renders as a checkbox input instead of display text.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { useEditableRow } from '@/components/puck/contexts/EditableRowContext';
import { useFieldMetadata } from '@/components/puck/hooks/useFieldMetadata';
import { BooleanInput } from '@/components/forms/inputs/BooleanInput';
import { cn } from '@/lib/utils';
import { Check, X, CircleCheck, CircleX } from 'lucide-react';
import styles from './styles.module.css';

export interface BooleanFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  displayStyle?: 'text' | 'badge' | 'icon';
  trueText?: string;
  falseText?: string;
  iconStyle?: 'check' | 'circle';
  size?: 'sm' | 'base' | 'lg';
  textColor?: string;
  fontFamily?: string;
}

export default function BooleanField({
  fieldId,
  label,
  labelPosition = 'top',
  displayStyle = 'text',
  trueText = 'Yes',
  falseText = 'No',
  iconStyle = 'check',
  size = 'base',
  textColor,
  fontFamily,
}: BooleanFieldProps) {
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
          BooleanField must be inside a Data block
        </span>
      </div>
    );
  }

  // ============================================
  // EDIT MODE: Render as uncontrolled checkbox input
  // ============================================
  if (editable?.isEditMode && field) {
    const initialValue = Boolean(value);

    return (
      <div className={styles.editContainer}>
        <BooleanInput
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
  // DISPLAY MODE: Render as text/badge/icon
  // ============================================

  // Convert value to boolean
  const boolValue = Boolean(value);

  const containerClass = cn(
    styles.booleanField,
    labelPosition === 'inline' && styles.inline
  );

  const renderValue = () => {
    const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

    if (displayStyle === 'icon') {
      if (iconStyle === 'circle') {
        return boolValue ? (
          <CircleCheck className={cn(styles.icon, styles.iconTrue)} size={iconSize} />
        ) : (
          <CircleX className={cn(styles.icon, styles.iconFalse)} size={iconSize} />
        );
      }
      return boolValue ? (
        <Check className={cn(styles.icon, styles.iconTrue)} size={iconSize} />
      ) : (
        <X className={cn(styles.icon, styles.iconFalse)} size={iconSize} />
      );
    }

    if (displayStyle === 'badge') {
      return (
        <span
          className={cn(
            styles.badge,
            boolValue ? styles.badgeTrue : styles.badgeFalse,
            styles[size]
          )}
        >
          {boolValue ? trueText : falseText}
        </span>
      );
    }

    // Default: text
    return (
      <span className={cn(styles.text, styles[size])}>
        {boolValue ? trueText : falseText}
      </span>
    );
  };

  const customStyles: React.CSSProperties = {
    ...(textColor && { color: textColor }),
    ...(fontFamily && { fontFamily }),
  };

  return (
    <div className={containerClass} style={customStyles}>
      {label && <label className={styles.label}>{label}</label>}
      {renderValue()}
    </div>
  );
}
