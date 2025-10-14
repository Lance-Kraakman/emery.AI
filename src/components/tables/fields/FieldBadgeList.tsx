'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, X } from 'lucide-react';

export type FieldBadgeType = 'relation' | 'file' | 'document';

export interface FieldBadgeItem {
  id: string | number;
  label: string;
  type?: FieldBadgeType;
  metadata?: Record<string, any>;
}

interface FieldBadgeListProps {
  items: FieldBadgeItem[];
  isEditMode?: boolean;
  compact?: boolean;
  maxVisible?: number;
  showAddButton?: boolean;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onItemClick?: (item: FieldBadgeItem, index: number) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * FieldBadgeList - Reusable badge list component for all field types
 *
 * Displays items as badges with:
 * - Type-specific icons (document/file/relation)
 * - Remove buttons (edit mode only)
 * - Add button (edit mode only)
 * - Compact mode for table cells
 * - Click handlers for interaction
 *
 * Used by: DocumentField, FileField, RelationField
 */
export function FieldBadgeList({
  items,
  isEditMode = false,
  compact = false,
  maxVisible = 3,
  showAddButton = true,
  onAdd,
  onRemove,
  onItemClick,
  disabled = false,
  emptyMessage
}: FieldBadgeListProps) {
  const itemsArray = Array.isArray(items) ? items : [];

  // If empty and not in edit mode, show empty message
  if (itemsArray.length === 0 && !isEditMode) {
    if (emptyMessage) {
      return (
        <div className="text-muted-foreground italic text-xs">
          {emptyMessage}
        </div>
      );
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {/* Render visible badges */}
      {itemsArray.slice(0, maxVisible).map((item, index) => (
        <div key={item.id || index} className="group relative">
          <Badge
            variant="outline"
            className={`
              ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'}
              ${onItemClick ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground' : ''}
              ${isEditMode && onRemove ? 'pr-6' : ''}
              transition-colors
              flex items-center gap-1
            `}
            onClick={(e) => {
              e.stopPropagation();
              if (onItemClick && !disabled) {
                onItemClick(item, index);
              }
            }}
            title={item.label}
          >
            <span className="truncate max-w-[120px]">{item.label}</span>
          </Badge>

          {/* Remove button (edit mode only, shows on hover) */}
          {isEditMode && onRemove && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(index);
              }}
              className={`
                absolute -right-1 -top-1
                ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                p-0
                opacity-0 group-hover:opacity-100
                transition-opacity
                bg-background border rounded-full shadow-sm
                hover:bg-destructive hover:text-destructive-foreground
              `}
              title="Remove"
            >
              <X className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} />
            </Button>
          )}
        </div>
      ))}

      {/* "+X more" badge if items exceed maxVisible */}
      {itemsArray.length > maxVisible && (
        <Badge
          variant="secondary"
          className={compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'}
        >
          +{itemsArray.length - maxVisible} more
        </Badge>
      )}

      {/* Add button (shows in compact mode always, or in edit mode) */}
      {showAddButton && onAdd && (compact || isEditMode) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`
            ${compact ? 'h-5 w-5' : 'h-6 w-6'}
            hover:bg-accent hover:text-accent-foreground
            flex-shrink-0
          `}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          disabled={disabled}
          title="Add item"
        >
          <PlusCircle className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </Button>
      )}
    </div>
  );
}
