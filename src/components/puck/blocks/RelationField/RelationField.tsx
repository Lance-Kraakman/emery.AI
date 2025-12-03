'use client';

/**
 * RelationField - Field Block Component (Display Only)
 *
 * Displays relation field values from the nearest data context.
 * Must be used inside DataBlock.
 * Shows related records as badges.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { cn } from '@/lib/utils';
import { Link2 } from 'lucide-react';
import styles from './styles.module.css';

export interface RelationFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  displayStyle?: 'badge' | 'list' | 'comma';
  maxItems?: number;
  size?: 'sm' | 'base' | 'lg';
  showIcon?: boolean;
  textColor?: string;
  fontFamily?: string;
}

interface RelationItem {
  id: string | number;
  value?: string;
}

export default function RelationField({
  fieldId,
  label,
  labelPosition = 'top',
  displayStyle = 'badge',
  maxItems = 5,
  size = 'base',
  showIcon = true,
  textColor,
  fontFamily,
}: RelationFieldProps) {
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
          RelationField must be inside a Data block
        </span>
      </div>
    );
  }

  // Parse relations
  const relations: RelationItem[] = Array.isArray(value) ? value : [];
  const displayRelations = relations.slice(0, maxItems);
  const remainingCount = relations.length - displayRelations.length;

  // No relations
  if (relations.length === 0) {
    return (
      <div className={cn(styles.relationField, labelPosition === 'inline' && styles.inline)}>
        {label && <label className={styles.label}>{label}</label>}
        <span className={cn(styles.empty, styles[size])}>—</span>
      </div>
    );
  }

  const containerClass = cn(
    styles.relationField,
    labelPosition === 'inline' && styles.inline
  );

  const customStyles: React.CSSProperties = {
    ...(textColor && { color: textColor }),
    ...(fontFamily && { fontFamily }),
  };

  const renderBadges = () => (
    <div className={styles.badgeContainer}>
      {displayRelations.map((relation, index) => (
        <span key={relation.id || index} className={cn(styles.badge, styles[size])}>
          {showIcon && <Link2 className={styles.badgeIcon} />}
          <span className={styles.badgeText}>
            {relation.value || `Record ${relation.id}`}
          </span>
        </span>
      ))}
      {remainingCount > 0 && (
        <span className={cn(styles.badge, styles.badgeMore, styles[size])}>
          +{remainingCount} more
        </span>
      )}
    </div>
  );

  const renderList = () => (
    <ul className={styles.list}>
      {displayRelations.map((relation, index) => (
        <li key={relation.id || index} className={cn(styles.listItem, styles[size])}>
          {showIcon && <Link2 className={styles.listIcon} />}
          <span>{relation.value || `Record ${relation.id}`}</span>
        </li>
      ))}
      {remainingCount > 0 && (
        <li className={cn(styles.listItem, styles.listMore, styles[size])}>
          +{remainingCount} more
        </li>
      )}
    </ul>
  );

  const renderComma = () => {
    const text = displayRelations
      .map(r => r.value || `Record ${r.id}`)
      .join(', ');
    const suffix = remainingCount > 0 ? ` +${remainingCount} more` : '';

    return (
      <span className={cn(styles.commaText, styles[size])}>
        {text}{suffix}
      </span>
    );
  };

  return (
    <div className={containerClass} style={customStyles}>
      {label && <label className={styles.label}>{label}</label>}
      {displayStyle === 'badge' && renderBadges()}
      {displayStyle === 'list' && renderList()}
      {displayStyle === 'comma' && renderComma()}
    </div>
  );
}
