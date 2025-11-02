'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  AVATAR_STYLES,
  AVATAR_COLORS,
  AVATAR_STYLE_LABELS,
  DEFAULT_AVATAR_CONFIG,
  generateAvatarDataUri,
  getAvatarColor,
  type AvatarStyleName,
  type AvatarColorName,
  type AvatarConfigV1,
} from '@/lib/avatars';
import { Check } from 'lucide-react';

interface AvatarPickerProps {
  value?: AvatarConfigV1 | null;
  onChange: (config: AvatarConfigV1) => void;
  className?: string;
}

/**
 * AvatarPicker - Interactive character style and color selector for agent avatars
 *
 * Allows users to:
 * 1. Select a character style from the available DiceBear options
 * 2. Select a color for the background
 * 3. Preview the selected combination in real-time
 */
export function AvatarPicker({ value, onChange, className }: AvatarPickerProps) {
  const config = value || DEFAULT_AVATAR_CONFIG;
  const [selectedStyle, setSelectedStyle] = useState<string>(config.style || 'lorelei');
  const [selectedColor, setSelectedColor] = useState<string>(config.color || 'blue');

  const handleStyleSelect = (styleName: string) => {
    setSelectedStyle(styleName);
    onChange({
      version: 1,
      style: styleName,
      color: selectedColor,
    });
  };

  const handleColorSelect = (colorName: string) => {
    setSelectedColor(colorName);
    onChange({
      version: 1,
      style: selectedStyle,
      color: colorName,
    });
  };

  // Generate preview avatar data URI
  const previewDataUri = useMemo(() => {
    return generateAvatarDataUri(selectedStyle, 'preview-' + selectedStyle, selectedColor);
  }, [selectedStyle, selectedColor]);

  const previewColors = getAvatarColor(selectedColor);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Preview */}
      <div className="flex flex-col items-center gap-3">
        <div className="text-sm font-medium text-muted-foreground">Preview</div>
        <div
          className={cn(
            'w-20 h-20 rounded-lg flex items-center justify-center overflow-hidden',
            previewColors.bg
          )}
        >
          <img
            src={previewDataUri}
            alt="Avatar preview"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Style Selector */}
      <div className="space-y-3">
        <div className="text-sm font-medium">Character Style</div>
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(AVATAR_STYLES).map((styleName) => {
            const isSelected = styleName === selectedStyle;
            // Generate a sample avatar for this style using a consistent seed
            const sampleDataUri = useMemo(() =>
              generateAvatarDataUri(styleName, 'sample-' + styleName, 'blue'),
              [styleName]
            );

            return (
              <button
                key={styleName}
                onClick={() => handleStyleSelect(styleName)}
                className={cn(
                  'relative flex flex-col items-center gap-1 p-2 rounded-md border-2 transition-all hover:scale-105',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                title={AVATAR_STYLE_LABELS[styleName as AvatarStyleName]}
              >
                <div className="w-12 h-12 rounded-md overflow-hidden bg-blue-500/20">
                  <img
                    src={sampleDataUri}
                    alt={AVATAR_STYLE_LABELS[styleName as AvatarStyleName]}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs text-center line-clamp-1">
                  {AVATAR_STYLE_LABELS[styleName as AvatarStyleName]}
                </span>
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Selector */}
      <div className="space-y-3">
        <div className="text-sm font-medium">Color</div>
        <div className="grid grid-cols-5 gap-2">
          {Object.keys(AVATAR_COLORS).map((colorName) => {
            const color = AVATAR_COLORS[colorName as AvatarColorName];
            const isSelected = colorName === selectedColor;

            return (
              <button
                key={colorName}
                onClick={() => handleColorSelect(colorName)}
                className={cn(
                  'relative aspect-square rounded-md border-2 flex items-center justify-center transition-all hover:scale-105',
                  color.bg,
                  isSelected
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'border-border hover:border-primary/50'
                )}
                title={colorName}
              >
                <div className={cn('w-6 h-6 rounded-full', color.bg, color.border, 'border-2')} />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
