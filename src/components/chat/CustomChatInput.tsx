'use client';

/**
 * CustomChatInput with Enhanced Tool Selection Support
 *
 * Chat input with @ tool selection functionality using ReferenceTool objects.
 * Supports @doc:, @file:, @agent:, @table:, @database: for tool selection.
 *
 * AIDEV-NOTE: Enhanced with proper Tool domain integration.
 * Uses ReferenceTool objects for type-safe tool configs and unified architecture.
 * Simplified @ detection using input change handler with DDD ToolDropdown.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToolDropdown } from './ToolDropdown';
import { resolveReferences } from '@/app/actions/references';
import type { ReferenceDTO } from '@/app/mappers/reference-mapper';
import type { ToolDTO } from '@/app/mappers/tool-mapper';

interface CustomChatInputProps {
  onSendMessage: (message: string) => void;
  onToolsChange?: (tools: ToolDTO[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CustomChatInput({
  onSendMessage,
  onToolsChange,
  placeholder = "Type your message here...",
  className = "",
  disabled = false
}: CustomChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedTools, setSelectedTools] = useState<ToolDTO[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Detect @ tools and show/hide dropdown
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setInputValue(value);

    // Find @ symbol before cursor
    const beforeCursor = value.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^@\s]*)$/);

    if (atMatch) {
      const query = atMatch[1] || '';
      setDropdownQuery(query);
      setShowDropdown(true);

      // Position above input since chat is at bottom of screen
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        const dropdownHeight = 400;
        const gap = 4;

        // Calculate optimal position to stay within viewport
        let top = rect.top - dropdownHeight - gap;
        let left = rect.left;

        // Prevent going off top of screen
        if (top < 0) {
          top = rect.bottom + gap; // Position below input instead
        }

        // Prevent going off right side of screen
        const dropdownWidth = 400; // min-w-96 = 384px, but give some buffer
        if (left + dropdownWidth > window.innerWidth) {
          left = window.innerWidth - dropdownWidth - 16; // 16px margin
        }

        // Prevent going off left side of screen
        if (left < 0) {
          left = 16; // 16px margin
        }

        setDropdownPosition({ top, left });
      }
    } else {
      setShowDropdown(false);
    }
  };

  // Handle tool selection - add to selected tools and update input
  const handleToolSelect = (tool: ToolDTO) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const beforeCursor = inputValue.slice(0, cursorPos);
    const afterCursor = inputValue.slice(cursorPos);

    // Find and replace the @ query with the full tool reference
    const atMatch = beforeCursor.match(/@[^@\s]*$/);
    if (atMatch) {
      const beforeAt = beforeCursor.slice(0, atMatch.index);
      // Get insertText from unified ToolDTO
      const insertText = tool.insertText || `@tool:${tool.name}`;
      const newValue = beforeAt + insertText + ' ' + afterCursor;
      setInputValue(newValue);

      // Add to selected tools
      const updatedTools = [...selectedTools, tool];
      setSelectedTools(updatedTools);
      onToolsChange?.(updatedTools);

      // Position cursor after inserted text
      const newCursorPos = beforeAt.length + (insertText?.length || 0) + 1;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    }

    setShowDropdown(false);
  };

  // Extract tool references from message text
  const extractToolReferences = (text: string): string[] => {
    const toolRegex = /@(tool|doc|file|table|agent|database):[^\s]+/g;
    return text.match(toolRegex) || [];
  };

  // Send message with tool resolution
  const handleSendMessage = async () => {
    if (inputValue.trim() && !disabled) {
      const message = inputValue.trim();

      // Check for manual tool references that need resolution
      const toolReferences = extractToolReferences(message);
      if (toolReferences.length > 0) {
        try {
          const result = await resolveReferences(toolReferences);
          if (result.success && result.data) {
            // Merge with existing selected tools
            const allTools = [...selectedTools];

            // Add new resolved tools (avoid duplicates)
            // Note: This uses legacy reference resolution, would need enhancement for full ReferenceTool support
            result.data.resolvedReferences.forEach(newTool => {
              const exists = allTools.some(existing => {
                const existingInsertText = existing.insertText || `@tool:${existing.name}`;
                return existingInsertText === newTool.insertText;
              });
              if (!exists) {
                // TODO: Convert ReferenceDTO to ToolDTO for proper typing
                // For now, keeping this section for backward compatibility
                console.warn('Manual reference resolution needs ToolDTO conversion');
              }
            });

            // Update tools (keeping existing since resolved refs need conversion)
            // setSelectedTools(allTools);
            // onToolsChange?.(allTools);
          }
        } catch (error) {
          console.error('Error resolving tool references:', error);
        }
      }

      // Send message
      onSendMessage(message);
      setInputValue('');
      setShowDropdown(false);

      // Keep selected tools visible after sending
      inputRef.current?.focus();
    }
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // When dropdown is open, prevent default behavior for navigation keys
    if (showDropdown && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return; // Let ToolDropdown handle these
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation(); // AIDEV-NOTE: Prevent event bubbling to parent forms
      handleSendMessage();
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
    <div className={`relative ${className}`}>
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-12"
          />

          {/* Tool Dropdown */}
          <ToolDropdown
            query={dropdownQuery}
            isOpen={showDropdown}
            onClose={() => setShowDropdown(false)}
            onSelect={handleToolSelect}
            position={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              maxHeight: 400,
            }}
          />
        </div>

        <Button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || disabled}
          size="sm"
          className="px-3"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Helpful hint */}
      {!inputValue && (
        <div className="text-xs text-gray-400 mt-1">
          Type @ to add tools, documents, agents, and more
        </div>
      )}
    </div>
  );
}