'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, X, File, FileText } from 'lucide-react';
import type { RelationArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

// Generic item interface for all field types
export interface LabelDisplayItem {
  id: string | number;
  value: string;                  // Display text
  type?: 'relation' | 'file' | 'document'; // Item type for styling
  metadata?: Record<string, any>; // File size, document type, etc.
}

interface LabelDisplayProps {
  items: LabelDisplayItem[];
  isEditMode?: boolean;
  compact?: boolean; // For tighter spacing in table cells
  maxVisible?: number; // Max badges to show before "+X more"
  showPlusButton?: boolean;
  onRemove?: (index: number) => void;
  onAdd?: () => void;
  disabled?: boolean;
}

// Helper function to get badge content based on item type
const getBadgeContent = (item: LabelDisplayItem) => {
  switch (item.type) {
    case 'file':
      return (
        <div className="flex items-center gap-1">
          <File className="h-3 w-3" />
          {item.value}
        </div>
      );
    case 'document':
      return (
        <div className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {item.value}
        </div>
      );
    case 'relation':
    default:
      return item.value || `Record ${item.id}`;
  }
};

export function LabelDisplay({
  items,
  isEditMode = false,
  compact = false,
  maxVisible = 2,
  showPlusButton = false,
  onRemove,
  onAdd,
  disabled = false
}: LabelDisplayProps) {
  const itemsArray = Array.isArray(items) ? items : [];
  
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {/* Show item badges */}
      {itemsArray.slice(0, maxVisible).map((item, index) => (
        <div key={item.id || index} className="group relative">
          <Badge 
            variant="outline" 
            className={`text-xs ${compact ? 'text-[10px]' : 'text-xs'} ${
              onRemove ? 'pr-6' : ''
            }`}
          >
            {getBadgeContent(item)}
          </Badge>
          
          {/* Remove button on hover (only in edit mode) */}
          {isEditMode && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(index);
              }}
              className={`absolute -right-1 -top-1 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-background border rounded-full ${
                compact ? 'h-3 w-3' : 'h-4 w-4'
              }`}
            >
              <X className={`${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`} />
            </Button>
          )}
        </div>
      ))}
      
      {/* Show +X more badge */}
      {itemsArray.length > maxVisible && (
        <Badge 
          variant="outline" 
          className={`text-xs ${compact ? 'text-[10px]' : 'text-xs'}`}
        >
          +{itemsArray.length - maxVisible} more
        </Badge>
      )}
      
      {/* Plus button */}
      {showPlusButton && isEditMode && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`${compact ? 'h-5 w-5' : 'h-6 w-6'}`}
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.();
          }}
          disabled={disabled}
        >
          <PlusCircle className={`${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
        </Button>
      )}
    </div>
  );
}

// Helper function to convert relations to LabelDisplayItem format
export const relationsToLabelItems = (relations: RelationArrayFieldValue): LabelDisplayItem[] => {
  if (!Array.isArray(relations)) return [];
  
  return relations.map(relation => ({
    id: relation.id,
    value: relation.value || `Record ${relation.id}`,
    type: 'relation' as const,
    metadata: relation
  }));
};