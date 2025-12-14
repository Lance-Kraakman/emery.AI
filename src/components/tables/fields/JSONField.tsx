'use client';

import { useState, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Braces, Check, X, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type JsonFieldValue = Record<string, unknown> | unknown[] | null;

interface JSONFieldProps {
  value: JsonFieldValue | undefined;
  onChange?: (value: JsonFieldValue) => void;
  isEditMode?: boolean;
  compact?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  focus?: boolean; // For keyboard shortcut support in grid cells
}

/**
 * JSONField - Component for JSON field type
 *
 * Display Mode (isEditMode=false):
 * - Shows JSON as a compact badge with key count or preview
 * - Click badge to view full JSON in popover
 *
 * Edit Mode + Compact (isEditMode=true, compact=true):
 * - Shows badge trigger in cell
 * - Click or Cmd+Enter opens popover with full JSON editor
 *
 * Edit Mode + Non-Compact (isEditMode=true, compact=false):
 * - Shows inline textarea with controls (for forms)
 */
export function JSONField({
  value,
  onChange,
  isEditMode = false,
  compact = false,
  disabled = false,
  readOnly = false,
  focus = false,
}: JSONFieldProps) {
  const [textValue, setTextValue] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Sync text value with prop value
  useEffect(() => {
    if (value !== undefined && value !== null) {
      try {
        setTextValue(JSON.stringify(value, null, 2));
        setIsValid(true);
        setErrorMessage(null);
      } catch {
        setTextValue(String(value));
        setIsValid(false);
      }
    } else {
      setTextValue('');
      setIsValid(true);
      setErrorMessage(null);
    }
  }, [value]);

  // Keyboard shortcuts: Cmd+Enter to open, Escape to close
  useEffect(() => {
    if (!focus || !compact || !isEditMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setIsEditorOpen(true);
      }
      if (e.key === 'Escape' && isEditorOpen) {
        e.preventDefault();
        setIsEditorOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focus, compact, isEditMode, isEditorOpen]);

  // Handle text change with validation
  const handleTextChange = useCallback((newText: string) => {
    setTextValue(newText);

    if (!newText.trim()) {
      setIsValid(true);
      setErrorMessage(null);
      onChange?.(null);
      return;
    }

    try {
      const parsed = JSON.parse(newText);
      setIsValid(true);
      setErrorMessage(null);
      onChange?.(parsed);
    } catch (e) {
      setIsValid(false);
      setErrorMessage(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [onChange]);

  // Format JSON (pretty print)
  const handleFormat = useCallback(() => {
    if (!textValue.trim()) return;
    try {
      const parsed = JSON.parse(textValue);
      setTextValue(JSON.stringify(parsed, null, 2));
      setIsValid(true);
      setErrorMessage(null);
    } catch {
      // Keep as-is if invalid
    }
  }, [textValue]);

  // Minify JSON
  const handleMinify = useCallback(() => {
    if (!textValue.trim()) return;
    try {
      const parsed = JSON.parse(textValue);
      setTextValue(JSON.stringify(parsed));
      setIsValid(true);
      setErrorMessage(null);
    } catch {
      // Keep as-is if invalid
    }
  }, [textValue]);

  // Clear JSON
  const handleClear = useCallback(() => {
    setTextValue('');
    setIsValid(true);
    setErrorMessage(null);
    onChange?.(null);
  }, [onChange]);

  // Get preview text for display mode
  const getPreviewText = (): string => {
    if (!value) return 'null';
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      if (keys.length <= 2 && compact) {
        return `{ ${keys.join(', ')} }`;
      }
      return `{ ${keys.length} keys }`;
    }
    return String(value);
  };

  // Empty state
  if (!value && !isEditMode) {
    return (
      <div className={compact ? 'text-xs' : 'text-sm'}>
        <span className="text-muted-foreground">—</span>
      </div>
    );
  }

  // Display mode - show badge with popover for full view
  if (!isEditMode || readOnly) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Badge
            variant="outline"
            className={`${compact ? 'text-[10px] px-1.5 py-0' : 'text-xs'} font-mono cursor-pointer hover:bg-accent`}
          >
            <Braces className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
            {getPreviewText()}
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Braces className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">JSON Data</span>
            </div>
          </div>
          <pre className="p-3 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap break-words">
            {JSON.stringify(value, null, 2)}
          </pre>
        </PopoverContent>
      </Popover>
    );
  }

  // Edit mode + compact - show badge trigger with popover editor
  if (compact) {
    return (
      <Popover open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <PopoverTrigger asChild>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-mono cursor-pointer hover:bg-accent"
          >
            <Braces className="h-2.5 w-2.5 mr-1" />
            {value ? getPreviewText() : 'Edit JSON'}
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-3" align="start" side="bottom">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <Braces className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">JSON Editor</span>
              {isValid && textValue && (
                <span className="ml-auto flex items-center text-xs text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Valid
                </span>
              )}
            </div>

            {/* Textarea */}
            <div className="relative">
              <Textarea
                value={textValue}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder='{ "key": "value" }'
                disabled={disabled}
                autoFocus
                className={`font-mono text-xs min-h-[150px] resize-none ${
                  !isValid ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
              />
              {!isValid && errorMessage && (
                <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 text-xs text-destructive bg-background/90 px-2 py-1 rounded">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFormat}
                disabled={disabled || !textValue.trim()}
                className="h-7 text-xs px-2"
              >
                Format
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMinify}
                disabled={disabled || !textValue.trim()}
                className="h-7 text-xs px-2"
              >
                Minify
              </Button>
              <div className="flex-1" />
              {textValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={disabled}
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Hint */}
            <p className="text-[10px] text-muted-foreground">
              Press Escape to close
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Edit mode + non-compact - show inline textarea with controls
  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          value={textValue}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder='{ "key": "value" }'
          disabled={disabled}
          className={`font-mono text-xs ${
            isExpanded ? 'min-h-[200px]' : 'min-h-[100px]'
          } ${!isValid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />
        {!isValid && errorMessage && (
          <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 text-xs text-destructive bg-background/90 px-2 py-1 rounded">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFormat}
          disabled={disabled || !textValue.trim()}
          className="h-6 text-xs px-2"
        >
          Format
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleMinify}
          disabled={disabled || !textValue.trim()}
          className="h-6 text-xs px-2"
        >
          Minify
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 text-xs px-2"
        >
          {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </Button>
        <div className="flex-1" />
        {textValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
            className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
        {isValid && textValue && (
          <span className="flex items-center text-xs text-green-600">
            <Check className="h-3 w-3 mr-1" />
            Valid
          </span>
        )}
      </div>
    </div>
  );
}
