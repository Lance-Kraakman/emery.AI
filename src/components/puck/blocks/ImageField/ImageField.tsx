'use client';

/**
 * ImageField - Field Block Component
 *
 * Displays image from file/URL field values from the nearest data context.
 * Must be used inside DataContextBlock or RepeatBlock.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { cn } from '@/lib/utils';
import styles from './styles.module.css';

export interface ImageFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  size?: 'small' | 'medium' | 'large' | 'full';
  shape?: 'square' | 'circle' | 'rounded';
  alt?: string;
  fallbackUrl?: string;
  maxItems?: number;
}

/**
 * Get image URL from file value
 * Files have s3Key which we use to construct the streaming URL
 */
function getImageUrl(file: unknown, fallback: string): string {
  if (!file || typeof file !== 'object') return fallback;

  const f = file as { s3Key?: string; url?: string; name?: string };

  // Use s3Key to construct streaming URL
  if (f.s3Key) {
    return `/api/files/stream?s3Key=${encodeURIComponent(f.s3Key)}`;
  }

  // Fallback to url property if exists (legacy support)
  if (f.url) return f.url;

  return fallback;
}

export default function ImageField({
  fieldId,
  label,
  labelPosition = 'top',
  size = 'medium',
  shape = 'rounded',
  alt = 'Image',
  fallbackUrl = '/placeholder-image.png',
  maxItems = 1,
}: ImageFieldProps) {
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
          ImageField must be inside a Data block
        </span>
      </div>
    );
  }

  // Get files to display
  let files: unknown[] = [];

  if (Array.isArray(value)) {
    files = value.slice(0, maxItems);
  } else if (value && typeof value === 'object') {
    files = [value];
  } else if (typeof value === 'string' && value) {
    // Direct URL string
    files = [{ url: value }];
  }

  // No files - show fallback
  if (files.length === 0) {
    files = [{ url: fallbackUrl }];
  }

  const imageWrapperClass = cn(
    styles.imageField,
    styles[size],
    styles[shape]
  );

  const containerClass = cn(
    styles.imageContainer,
    labelPosition === 'inline' && styles.inline
  );

  return (
    <div className={containerClass}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={files.length > 1 ? styles.imageGrid : undefined}>
        {files.map((file, index) => (
          <div key={index} className={imageWrapperClass}>
            <img
              src={getImageUrl(file, fallbackUrl)}
              alt={`${alt}${files.length > 1 ? ` ${index + 1}` : ''}`}
              className={styles.image}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
