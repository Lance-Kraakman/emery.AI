'use client';

/**
 * LinkField - Field Block Component
 *
 * Displays URL field values from the nearest data context.
 * Must be used inside DataBlock.
 * Renders URLs as clickable links with various display options.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { cn } from '@/lib/utils';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';
import styles from './styles.module.css';

export interface LinkFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  displayStyle?: 'text' | 'button' | 'icon';
  linkText?: string;
  openInNewTab?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'base' | 'lg';
  fallback?: string;
}

function formatUrl(url: string): string {
  // Remove protocol for display
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function ensureProtocol(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

export default function LinkField({
  fieldId,
  label,
  labelPosition = 'top',
  displayStyle = 'text',
  linkText,
  openInNewTab = true,
  showIcon = true,
  size = 'base',
  fallback = '',
}: LinkFieldProps) {
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
          LinkField must be inside a Data block
        </span>
      </div>
    );
  }

  // Get URL value
  const url = typeof value === 'string' ? value.trim() : '';

  // No URL
  if (!url) {
    return (
      <div className={cn(styles.linkField, labelPosition === 'inline' && styles.inline)}>
        {label && <label className={styles.label}>{label}</label>}
        <span className={cn(styles.empty, styles[size])}>
          {fallback || '—'}
        </span>
      </div>
    );
  }

  const containerClass = cn(
    styles.linkField,
    labelPosition === 'inline' && styles.inline
  );

  const href = ensureProtocol(url);
  const displayText = linkText || formatUrl(url);
  const linkProps = openInNewTab
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  const renderText = () => (
    <a href={href} className={cn(styles.textLink, styles[size])} {...linkProps}>
      {showIcon && <ExternalLink className={styles.linkIcon} />}
      <span className={styles.linkText}>{displayText}</span>
    </a>
  );

  const renderButton = () => (
    <a href={href} className={cn(styles.buttonLink, styles[size])} {...linkProps}>
      {showIcon && <ExternalLink className={styles.buttonIcon} />}
      <span>{linkText || 'Open Link'}</span>
    </a>
  );

  const renderIcon = () => (
    <a href={href} className={cn(styles.iconLink, styles[size])} {...linkProps} title={url}>
      <LinkIcon className={styles.iconOnly} />
    </a>
  );

  return (
    <div className={containerClass}>
      {label && <label className={styles.label}>{label}</label>}
      {displayStyle === 'text' && renderText()}
      {displayStyle === 'button' && renderButton()}
      {displayStyle === 'icon' && renderIcon()}
    </div>
  );
}
