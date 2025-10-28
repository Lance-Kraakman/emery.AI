'use client';

/**
 * InstructionsWithToolsInput - Shared Component
 *
 * Reusable textarea for instructions with @ mention functionality to select tools.
 * Used by: Skills (step instructions), Schedules (task instructions), Tasks, etc.
 *
 * Features:
 * - @ mention detection and tool dropdown
 * - Automatic tool reference insertion (@doc:filename, @tool:name, etc.)
 * - Manages both text content and tools array
 * - Keyboard navigation support
 * - Smart positioning (prevents off-screen dropdowns)
 *
 * AIDEV-NOTE: Extracted from StepInstructionsInput for reusability
 */

import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ToolDropdown } from '@/components/chat/ToolDropdown';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import type { ToolConfigDTO } from '@/app/mappers/skill-mapper';

interface InstructionsWithToolsInputProps {
  value: string;                           // Instructions text
  onChange: (value: string) => void;
  tools: ToolConfigDTO[];                  // Selected tools
  onToolsChange: (tools: ToolConfigDTO[]) => void;
  placeholder?: string;
  label?: string;
  helpText?: string;
  id?: string;
  className?: string;
  minHeight?: string;                      // e.g., "300px"
}

export function InstructionsWithToolsInput({
  value,
  onChange,
  tools,
  onToolsChange,
  placeholder = "Enter instructions... (Type @ to add tools)",
  label,
  helpText,
  id = 'instructions-input',
  className = '',
  minHeight = '300px'
}: InstructionsWithToolsInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight?: number;
  }>({ left: 0 });

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Detect @ mentions and show/hide dropdown
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setLocalValue(newValue);
    onChange(newValue);

    // Find @ symbol before cursor - allow spaces in search but exclude completed tool references
    const beforeCursor = newValue.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^@]*)$/);

    // Don't show dropdown if we're in a completed tool reference
    const isCompletedTool = atMatch && (
      atMatch[0].startsWith('@tool:') ||
      atMatch[0].startsWith('@doc:') ||
      atMatch[0].startsWith('@file:') ||
      atMatch[0].startsWith('@agent:') ||
      atMatch[0].startsWith('@table:') ||
      atMatch[0].startsWith('@database:')
    );

    if (atMatch && !isCompletedTool) {
      const query = atMatch[1] || '';
      setDropdownQuery(query);
      setShowDropdown(true);

      // Position above textarea
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        const gap = 8;

        // Position dropdown so its bottom is at the top of the textarea
        const bottom = window.innerHeight - rect.top + gap;
        const maxHeight = rect.top - gap - 20; // 20px margin from top

        let left = rect.left;
        const dropdownWidth = 440;

        // Prevent going off right side
        if (left + dropdownWidth > window.innerWidth) {
          left = window.innerWidth - dropdownWidth - 16;
        }

        // Prevent going off left side
        if (left < 0) {
          left = 16;
        }

        setDropdownPosition({ bottom, left, maxHeight });
      }
    } else {
      setShowDropdown(false);
    }
  };

  // Handle tool selection - add to tools array and insert text reference
  const handleToolSelect = (tool: ToolDTO) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const beforeCursor = localValue.slice(0, cursorPos);
    const afterCursor = localValue.slice(cursorPos);

    // Find and replace the @ query with the full tool reference
    const atMatch = beforeCursor.match(/@[^@]*$/);
    if (atMatch) {
      const beforeAt = beforeCursor.slice(0, atMatch.index);

      // Get reference text based on tool type
      const getReference = () => {
        if (tool.type !== 'reference') return `@tool:${tool.name}`;

        switch (tool.category) {
          case 'documents': return `@doc:${tool.name}`;
          case 'files': return `@file:${tool.name}`;
          case 'agents': return `@agent:${tool.name}`;
          case 'tables': return `@table:${tool.name}`;
          case 'databases': return `@database:${tool.name}`;
          default: return `@tool:${tool.name}`;
        }
      };

      const rawInsertText = tool.insertText || getReference();
      // Remove line breaks and extra whitespace
      const insertText = rawInsertText.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      const newValue = beforeAt + insertText + ' ' + afterCursor;

      // Update local state immediately for cursor positioning
      setLocalValue(newValue);
      onChange(newValue);

      // Add to tools array
      const toolConfig: ToolConfigDTO = {
        name: insertText,
        config: {
          displayName: tool.displayName,
          category: tool.category,
          type: tool.type
        }
      };

      const updatedTools = [...tools, toolConfig];
      onToolsChange(updatedTools);

      // Position cursor after inserted text
      const newCursorPos = beforeAt.length + insertText.length + 1;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    }

    setShowDropdown(false);
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When dropdown is open, prevent default behavior for navigation keys
    if (showDropdown && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return; // Let ToolDropdown handle these
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showDropdown) return;

      const target = event.target as Node;
      const input = inputRef.current;
      const dropdown = document.querySelector('[data-tool-dropdown]');

      // Don't close if clicking on input or dropdown elements
      if (input && input.contains(target)) return;
      if (dropdown && dropdown.contains(target)) return;

      setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      )}

      {helpText && (
        <p className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}

      <div className="relative">
        <Textarea
          ref={inputRef}
          id={id}
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="resize-y text-base"
          style={{ minHeight }}
        />

        {/* Tool Dropdown */}
        <ToolDropdown
          query={dropdownQuery}
          isOpen={showDropdown}
          onClose={() => setShowDropdown(false)}
          onSelect={handleToolSelect}
          position={dropdownPosition}
        />
      </div>
    </div>
  );
}
