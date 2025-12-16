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
  const [isMounted, setIsMounted] = useState(false);

  // Reset state when modal opens with new config
  useEffect(() => {
    if (isOpen) {
      setIsMounted(false);

      if (initialConfig) {
        setSelectedStyle(initialConfig.style || 'lorelei');
        setSelectedColor(initialConfig.color || 'blue');
        setSeed(initialConfig.seed || generateRandomSeed());
        setOptions(initialConfig.options || {});
      } else {
        // Generate new random avatar when opening without config
        setSelectedStyle('lorelei');
        setSelectedColor('blue');
        setSeed(generateRandomSeed());
        setOptions({});
      }

      // Wait for next tick to ensure DOM is ready
      setTimeout(() => setIsMounted(true), 0);
    } else {
      setIsMounted(false);
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

  // Don't render anything if modal is not open
  if (!isOpen) {
    return null;
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Avatar"
      size="xl"
      closeOnEscape={true}
      closeOnOutsideClick={true}
    >
      {!isMounted ? (
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <div className="p-3 space-y-3 max-h-[80vh] overflow-y-auto">
        {/* Large Preview with Regenerate */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-20 h-20 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0',
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate Random
          </button>
        </div>

        {/* Style Selection Grid */}
        <div className="space-y-1.5">
          <Label className="text-sm">Character Style</Label>
          <div className="grid grid-cols-4 gap-1">
            {Object.keys(AVATAR_STYLES).map((styleName) => {
              const isSelected = styleName === selectedStyle;
              const stylePreviewUri = generateAvatarDataUri(styleName, `preview-${styleName}`, selectedColor, {});

              return (
                <button
                  key={styleName}
                  onClick={() => handleStyleChange(styleName)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all hover:scale-105',
                    isSelected
                      ? 'border-primary ring-2 ring-primary ring-offset-2 bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                  type="button"
                >
                  <div className={cn('w-10 h-10 rounded-md overflow-hidden', previewColors.bg)}>
                    <img
                      src={stylePreviewUri}
                      alt={AVATAR_STYLE_LABELS[styleName as AvatarStyleName]}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight">
                    {AVATAR_STYLE_LABELS[styleName as AvatarStyleName]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Selection */}
        <div className="space-y-1.5">
          <Label className="text-sm">Background Color</Label>
          <div className="grid grid-cols-5 gap-1">
            {Object.keys(AVATAR_COLORS).map((colorName) => {
              const color = AVATAR_COLORS[colorName as AvatarColorName];
              const isSelected = colorName === selectedColor;

              return (
                <button
                  key={colorName}
                  onClick={() => handleColorChange(colorName)}
                  className={cn(
                    'relative h-8 rounded-md border-2 flex items-center justify-center transition-all hover:scale-105',
                    color.bg,
                    isSelected
                      ? 'border-primary ring-2 ring-primary ring-offset-1'
                      : 'border-border hover:border-primary/50'
                  )}
                  title={colorName}
                >
                  <div className={cn('w-3 h-3 rounded-full', color.bg)} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Style-Specific Options */}
        {styleConfig && styleConfig.options.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <h3 className="text-xs font-medium">Customization Options</h3>
            {styleConfig.options.map((option) => (
              <div key={option.name} className="space-y-1">
                <Label htmlFor={option.name} className="text-xs">{option.label}</Label>

                {option.type === 'select' && option.options && (
                  <Select
                    value={options[option.name] || undefined}
                    onValueChange={(value) => {
                      if (value === '__random__') {
                        // Remove the option to make it random
                        const newOptions = { ...options };
                        delete newOptions[option.name];
                        setOptions(newOptions);
                      } else {
                        handleOptionChange(option.name, value);
                      }
                    }}
                  >
                    <SelectTrigger id={option.name}>
                      <SelectValue placeholder="Random" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__random__">Random</SelectItem>
                      {option.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {option.type === 'probability' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{option.description}</span>
                      <span className="font-medium">{options[option.name] || option.default || 0}%</span>
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
      )}

      {/* Footer */}
      {isMounted && (
        <div className="flex justify-end gap-2 px-3 py-2.5 border-t bg-muted/50">
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
      )}
    </BaseModal>
  );
}
