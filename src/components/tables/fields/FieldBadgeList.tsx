'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, X, ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  onItemOpen?: (item: FieldBadgeItem, index: number) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * FieldBadgeList - Reusable badge list component for all field types
 *
 * Displays items as badges with:
 * - Type-specific icons (document/file/relation)
 * - Open button (always available when onItemOpen provided)
 * - Remove buttons (edit mode only, with confirmation)
 * - Add button (edit mode only)
 * - Compact mode for table cells
 * - Click handlers for interaction
 * - Styled tooltips for truncated labels
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
  onItemOpen,
  disabled = false,
  emptyMessage
}: FieldBadgeListProps) {
  const itemsArray = Array.isArray(items) ? items : [];
  const [removeConfirmIndex, setRemoveConfirmIndex] = useState<number | null>(null);

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

  const handleRemoveClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoveConfirmIndex(index);
  };

  const handleConfirmRemove = () => {
    if (removeConfirmIndex !== null && onRemove) {
      onRemove(removeConfirmIndex);
    }
    setRemoveConfirmIndex(null);
  };

  const itemToRemove = removeConfirmIndex !== null ? itemsArray[removeConfirmIndex] : null;

  return (
    <>
      <div className={`flex flex-nowrap items-center overflow-hidden ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {/* Render visible badges */}
        {itemsArray.slice(0, maxVisible).map((item, index) => (
          <div key={item.id || index} className="group flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`
                    ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'}
                    ${onItemClick ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground' : ''}
                    transition-colors
                    flex items-center gap-1
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onItemClick && !disabled) {
                      onItemClick(item, index);
                    }
                  }}
                >
                  <span className="truncate max-w-[80px]">{item.label}</span>

                  {/* Action buttons inside badge (visible on hover) */}
                  {(onItemOpen || (isEditMode && onRemove)) && !disabled && (
                    <span className="hidden group-hover:flex items-center gap-0.5 ml-0.5">
                      {onItemOpen && (
                        <ExternalLink
                          className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} cursor-pointer hover:text-primary transition-colors`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemOpen(item, index);
                          }}
                        />
                      )}
                      {isEditMode && onRemove && (
                        <X
                          className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} cursor-pointer hover:text-destructive transition-colors`}
                          onClick={(e) => handleRemoveClick(index, e)}
                        />
                      )}
                    </span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs break-words">
                {item.label}
              </TooltipContent>
            </Tooltip>
          </div>
        ))}

        {/* "+X more" badge if items exceed maxVisible */}
        {itemsArray.length > maxVisible && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={`${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} flex-shrink-0 cursor-default`}
              >
                +{itemsArray.length - maxVisible}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {itemsArray.slice(maxVisible).map(item => item.label).join(', ')}
            </TooltipContent>
          </Tooltip>
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

      {/* Remove confirmation dialog */}
      <AlertDialog open={removeConfirmIndex !== null} onOpenChange={(open) => !open && setRemoveConfirmIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{itemToRemove?.label}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
