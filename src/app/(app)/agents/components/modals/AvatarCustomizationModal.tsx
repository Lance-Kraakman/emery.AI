'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BaseModal } from './BaseModal';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateAvatarDataUri,
  generateRandomSeed,
  getAvatarColor,
  AVATAR_STYLES,
  AVATAR_COLORS,
  AVATAR_STYLE_LABELS,
  type AvatarConfigV1,
  type AvatarStyleName,
  type AvatarColorName,
} from '@/lib/avatars';
import { getStyleOptions, type StyleOption } from '@/lib/avatar-options';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface AvatarCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: AvatarConfigV1 | null;
  onSave: (config: AvatarConfigV1) => void;
}

/**
 * AvatarCustomizationModal - Enhanced avatar customization with regeneration
 *
 * Features:
 * - Large preview with regenerate button
 * - Style and color selection
 * - Style-specific customization options (hair, accessories, etc.)
 * - Deterministic generation using seeds
 */
export function AvatarCustomizationModal({
  isOpen,
  onClose,
  initialConfig,
  onSave,
}: AvatarCustomizationModalProps) {
  // Initialize state from config or defaults
  const [selectedStyle, setSelectedStyle] = useState<string>('lorelei');
  const [selectedColor, setSelectedColor] = useState<string>('blue');
  const [seed, setSeed] = useState<string>(generateRandomSeed());
  const [options, setOptions] = useState<Record<string, any>>({});

  // Reset state when modal opens with new config
  useEffect(() => {
    if (isOpen && initialConfig) {
      setSelectedStyle(initialConfig.style || 'lorelei');
      setSelectedColor(initialConfig.color || 'blue');
      setSeed(initialConfig.seed || generateRandomSeed());
      setOptions(initialConfig.options || {});
    } else if (isOpen && !initialConfig) {
      // Generate new random avatar when opening without config
      setSelectedStyle('lorelei');
      setSelectedColor('blue');
      setSeed(generateRandomSeed());
      setOptions({});
    }
  }, [isOpen, initialConfig]);

  // Get style-specific options
  const styleConfig = useMemo(() => getStyleOptions(selectedStyle), [selectedStyle]);

  // Generate preview
  const previewDataUri = useMemo(() => {
    try {
      return generateAvatarDataUri(selectedStyle, seed, selectedColor, options);
    } catch (error) {
      console.error('Error generating avatar:', error);
      return '';
    }
  }, [selectedStyle, seed, selectedColor, options]);

  const previewColors = useMemo(() => getAvatarColor(selectedColor), [selectedColor]);

  // Handle regenerate - creates new random seed
  const handleRegenerate = () => {
    setSeed(generateRandomSeed());
  };

  // Handle style change
  const handleStyleChange = (newStyle: string) => {
    setSelectedStyle(newStyle);
    setOptions({}); // Reset options when style changes
  };

  // Handle color change
  const handleColorChange = (colorName: string) => {
    setSelectedColor(colorName);
  };

  // Handle option change
  const handleOptionChange = (optionName: string, value: any) => {
    setOptions(prev => ({
      ...prev,
      [optionName]: value
    }));
  };

  const handleSave = () => {
    const config: AvatarConfigV1 = {
      version: 1,
      style: selectedStyle,
      color: selectedColor,
      seed,
      options
    };
    onSave(config);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Avatar"
      size="lg"
      closeOnEscape={true}
      closeOnOutsideClick={true}
    >
      <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Large Preview with Regenerate */}
        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              'w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden',
              previewColors.bg
            )}
          >
            {previewDataUri ? (
              <img
                src={previewDataUri}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground text-sm">Loading...</div>
            )}
          </div>
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate Random
          </button>
        </div>

        {/* Style Selection */}
        <div className="space-y-2">
          <Label htmlFor="style">Character Style</Label>
          <Select value={selectedStyle} onValueChange={handleStyleChange}>
            <SelectTrigger id="style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(AVATAR_STYLES).map((styleName) => (
                <SelectItem key={styleName} value={styleName}>
                  {AVATAR_STYLE_LABELS[styleName as AvatarStyleName]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Color Selection */}
        <div className="space-y-2">
          <Label>Background Color</Label>
          <div className="grid grid-cols-5 gap-2">
            {Object.keys(AVATAR_COLORS).map((colorName) => {
              const color = AVATAR_COLORS[colorName as AvatarColorName];
              const isSelected = colorName === selectedColor;

              return (
                <button
                  key={colorName}
                  onClick={() => handleColorChange(colorName)}
                  className={cn(
                    'relative aspect-square rounded-md border-2 flex items-center justify-center transition-all hover:scale-105',
                    color.bg,
                    isSelected
                      ? 'border-primary ring-2 ring-primary ring-offset-2'
                      : 'border-border hover:border-primary/50'
                  )}
                  title={colorName}
                >
                  <div className={cn('w-6 h-6 rounded-full', color.bg)} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Style-Specific Options */}
        {styleConfig && styleConfig.options.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-medium">Customization Options</h3>
            {styleConfig.options.map((option) => (
              <div key={option.name} className="space-y-2">
                <Label htmlFor={option.name}>{option.label}</Label>

                {option.type === 'select' && option.options && (
                  <Select
                    value={options[option.name] || ''}
                    onValueChange={(value) => handleOptionChange(option.name, value)}
                  >
                    <SelectTrigger id={option.name}>
                      <SelectValue placeholder="Random" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Random</SelectItem>
                      {option.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {option.type === 'probability' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{option.description}</span>
                      <span>{options[option.name] || option.default || 0}%</span>
                    </div>
                    <input
                      type="range"
                      value={options[option.name] || option.default || 0}
                      onChange={(e) => handleOptionChange(option.name, parseInt(e.target.value, 10))}
                      min={0}
                      max={100}
                      step={10}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/50">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Save Avatar
        </button>
      </div>
    </BaseModal>
  );
}
