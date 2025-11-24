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
import Image from 'next/image';

export interface ImageFieldProps {
  fieldId: number;
  label?: string;
  size?: 'small' | 'medium' | 'large' | 'full';
  shape?: 'square' | 'circle' | 'rounded';
  alt?: string;
  fallbackUrl?: string;
}

export default function ImageField({
  fieldId,
  label,
  size = 'medium',
  shape = 'rounded',
  alt = 'Image',
  fallbackUrl = '/placeholder-image.png',
}: ImageFieldProps) {
  const isInContext = useIsInDataContext();
  const value = useFieldValue(fieldId);

  // Not in data context - show warning
  if (!isInContext) {
    return (
      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span className={styles.warningText}>
          ImageField must be inside a DataContextBlock or RepeatBlock
        </span>
      </div>
    );
  }

  // Get image URL
  let imageUrl = value;

  // Handle different value types
  if (Array.isArray(imageUrl) && imageUrl.length > 0) {
    // File field returns array of objects
    imageUrl = imageUrl[0]?.url || imageUrl[0]?.name || fallbackUrl;
  } else if (typeof imageUrl === 'object' && imageUrl !== null) {
    // File object
    imageUrl = imageUrl.url || imageUrl.name || fallbackUrl;
  } else if (!imageUrl || typeof imageUrl !== 'string') {
    imageUrl = fallbackUrl;
  }

  const containerClass = cn(
    styles.imageField,
    styles[size],
    styles[shape]
  );

  return (
    <div className={styles.imageContainer}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={containerClass}>
        <img
          src={imageUrl}
          alt={alt}
          className={styles.image}
        />
      </div>
    </div>
  );
}
