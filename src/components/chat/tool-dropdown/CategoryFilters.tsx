import React from 'react';
import { ReferenceCategory, REFERENCE_CATEGORY_INFO } from '@/ddd/domain/chat/value-objects/reference-types';
import { cn } from '@/lib/utils';
import { categoryIcons, categoryColors } from './utils';

interface CategoryFiltersProps {
  selectedCategories: ReferenceCategory[];
  onToggleCategory: (category: ReferenceCategory) => void;
  focusedIndex?: number;
  isInCategoryMode?: boolean;
}

/**
 * Category filter buttons grid - Two rows of 3 categories each
 */
export function CategoryFilters({
  selectedCategories,
  onToggleCategory,
  focusedIndex = -1,
  isInCategoryMode = false,
}: CategoryFiltersProps) {
  // Split categories into two rows
  const row1Categories = [ReferenceCategory.DOC, ReferenceCategory.FILE, ReferenceCategory.AGENT];
  const row2Categories = [ReferenceCategory.TABLE, ReferenceCategory.DATABASE, ReferenceCategory.SKILL];

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
          'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap',
          isSelected
            ? cn(
                categoryColors[category],
                'ring-1 ring-offset-1 shadow-sm',
                // Ring colors by category
                category === ReferenceCategory.DOC && 'ring-blue-400',
                category === ReferenceCategory.FILE && 'ring-green-400',
                category === ReferenceCategory.AGENT && 'ring-purple-400',
                category === ReferenceCategory.TABLE && 'ring-orange-400',
                category === ReferenceCategory.DATABASE && 'ring-gray-400',
                category === ReferenceCategory.SKILL && 'ring-pink-400'
              )
            : 'text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700',
          isFocused && 'ring-2 ring-blue-500 ring-offset-1'
        )}
        title={categoryInfo.description}
      >
        <Icon className="w-3 h-3" />
        {categoryInfo.label}
      </button>
    );
  };

  return (
    <div className="p-2.5 border-b border-gray-100">
      <div className="space-y-1.5">
        {/* Row 1: Documents, Files, Agents */}
        <div className="grid grid-cols-3 gap-1.5">
          {row1Categories.map((category, index) => renderCategoryButton(category, index))}
        </div>

        {/* Row 2: Tables, Databases, Skills */}
        <div className="grid grid-cols-3 gap-1.5">
          {row2Categories.map((category, index) => renderCategoryButton(category, index + 3))}
        </div>
      </div>
    </div>
  );
}
