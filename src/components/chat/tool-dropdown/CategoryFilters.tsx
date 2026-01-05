import React from 'react';
import { ReferenceCategory, REFERENCE_CATEGORY_INFO } from '@/ddd/domain/chat/value-objects/reference-types';
import { cn } from '@/lib/utils';
import { categoryIcons, categoryColors } from './utils';

interface CategoryFiltersProps {
  selectedCategories: ReferenceCategory[];
  onToggleCategory: (category: ReferenceCategory) => void;
  focusedIndex?: number;
  isInCategoryMode?: boolean;
  /** Compact mode shows icons only in a single row */
  compact?: boolean;
}

/**
 * Category filter buttons - compact (icons only) or full (with labels)
 */
export function CategoryFilters({
  selectedCategories,
  onToggleCategory,
  focusedIndex = -1,
  isInCategoryMode = false,
  compact = false,
}: CategoryFiltersProps) {
  const allCategories = [
    ReferenceCategory.DOC,
    ReferenceCategory.FILE,
    ReferenceCategory.AGENT,
    ReferenceCategory.TABLE,
    ReferenceCategory.DATABASE,
    ReferenceCategory.SKILL,
  ];

  const renderCategoryButton = (category: ReferenceCategory, globalIndex: number) => {
    const Icon = categoryIcons[category];
    const categoryInfo = REFERENCE_CATEGORY_INFO[category];
    const isSelected = selectedCategories.includes(category);
    const isFocused = isInCategoryMode && focusedIndex === globalIndex;

    return (
      <button
        key={category}
        onClick={() => onToggleCategory(category)}
        className={cn(
          'flex items-center justify-center rounded-md font-medium transition-all',
          compact ? 'p-1.5' : 'gap-1 px-2 py-1 text-xs whitespace-nowrap',
          isSelected
            ? cn(
                categoryColors[category],
                'ring-1 ring-offset-1 shadow-sm',
                category === ReferenceCategory.DOC && 'ring-blue-400',
                category === ReferenceCategory.FILE && 'ring-green-400',
                category === ReferenceCategory.AGENT && 'ring-purple-400',
                category === ReferenceCategory.TABLE && 'ring-orange-400',
                category === ReferenceCategory.DATABASE && 'ring-gray-400',
                category === ReferenceCategory.SKILL && 'ring-pink-400'
              )
            : 'text-muted-foreground bg-muted hover:bg-accent hover:text-accent-foreground',
          isFocused && 'ring-2 ring-blue-500 ring-offset-1'
        )}
        title={categoryInfo.description}
      >
        <Icon className={compact ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        {!compact && categoryInfo.label}
      </button>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {allCategories.map((category, index) => renderCategoryButton(category, index))}
      </div>
    );
  }

  // Full mode - two rows
  const row1Categories = allCategories.slice(0, 3);
  const row2Categories = allCategories.slice(3);

  return (
    <div className="p-2.5 border-b border-border">
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          {row1Categories.map((category, index) => renderCategoryButton(category, index))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {row2Categories.map((category, index) => renderCategoryButton(category, index + 3))}
        </div>
      </div>
    </div>
  );
}
