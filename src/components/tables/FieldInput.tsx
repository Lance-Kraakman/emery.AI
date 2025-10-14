'use client';

import React from 'react';
import { LabelDisplay } from '@/components/tables/LabelDisplay';
import type { LabelDisplayItem } from '@/components/tables/LabelDisplay';

interface FieldInputProps {
  items: LabelDisplayItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onItemClick?: (item: LabelDisplayItem, index: number) => void; // Add click handler prop
  error?: string;
  isEditMode?: boolean;
  disabled?: boolean;
  showPlusButton?: boolean;
  requiredMessage?: string;
  children?: React.ReactNode; // For field-specific popups/content
}

/**
 * Pure UI component for field input.
 * Handles display and user interactions, delegates actions to parent.
 */
export function FieldInput({
  items,
  onAdd,
  onRemove,
  onItemClick,
  error,
  isEditMode = true,
  disabled = false,
  showPlusButton = true,
  requiredMessage,
  children
}: FieldInputProps) {
  const itemsArray = items || [];

  return (
    <div className="space-y-3">
      {/* Main Input Area - Using LabelDisplay */}
      <LabelDisplay
        items={itemsArray}
        isEditMode={isEditMode}
        showPlusButton={isEditMode && showPlusButton}
        onRemove={onRemove}
        onAdd={onAdd}
        onItemClick={onItemClick}
        disabled={disabled}
      />

      {/* Error message */}
      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      {/* Required field indicator */}
      {requiredMessage && itemsArray.length === 0 && isEditMode && (
        <div className="text-sm text-muted-foreground">
          {requiredMessage}
        </div>
      )}

      {/* Field-specific content (popups, dialogs, etc.) */}
      {children}
    </div>
  );
}